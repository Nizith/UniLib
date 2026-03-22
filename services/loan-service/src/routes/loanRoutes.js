const express = require("express");
const { body, validationResult } = require("express-validator");
const axios = require("axios");
const Loan = require("../models/Loan");
const { auth } = require("../middleware/auth");
const { INTERNAL_SERVICE_HEADER, requireInternalService } = require("../middleware/serviceAuth");

const router = express.Router();

const BOOK_SERVICE_URL = process.env.BOOK_SERVICE_URL || "http://localhost:3002";
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";
const internalServiceHeaders = process.env.INTERNAL_SERVICE_TOKEN
  ? { [INTERNAL_SERVICE_HEADER]: process.env.INTERNAL_SERVICE_TOKEN }
  : {};
const canViewUserLoans = (requestUser, resourceUserId) =>
  requestUser && (requestUser.id === resourceUserId || requestUser.role === "admin" || requestUser.role === "staff");
const normalizeAvailableCopies = (book) => {
  const totalCopies = Number(book.totalCopies) || 0;
  const availableCopies = Number(book.availableCopies) || 0;

  return Math.min(Math.max(availableCopies, 0), totalCopies);
};

// POST /borrow - Borrow a book (protected)
router.post(
  "/borrow",
  auth,
  [body("bookId").notEmpty().withMessage("bookId is required")],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { bookId } = req.body;
      const userId = req.user.id;

      // Check if user already has this book borrowed
      const existingLoan = await Loan.findOne({
        userId,
        bookId,
        status: "borrowed",
      });

      if (existingLoan) {
        return res.status(400).json({ message: "You have already borrowed this book" });
      }

      // Call Book Catalog Service to check availability
      let book;
      try {
        const bookResponse = await axios.get(`${BOOK_SERVICE_URL}/api/books/${bookId}`);
        book = bookResponse.data;
      } catch (error) {
        if (error.response && error.response.status === 404) {
          return res.status(404).json({ message: "Book not found" });
        }
        return res.status(503).json({ message: "Book service unavailable" });
      }

      if (book.availableCopies <= 0) {
        return res.status(400).json({ message: "No copies available for borrowing" });
      }

      // Calculate due date (14 days from now)
      const dueDate = new Date();
      dueDate.setDate(dueDate.getDate() + 14);

      // Create loan record
      const loan = new Loan({
        userId,
        bookId,
        bookTitle: book.title,
        dueDate,
      });

      const savedLoan = await loan.save();

      // Update book availability (decrement availableCopies)
      try {
        const normalizedAvailableCopies = normalizeAvailableCopies(book);

        await axios.patch(
          `${BOOK_SERVICE_URL}/api/books/${bookId}/availability`,
          {
            availableCopies: Math.max(normalizedAvailableCopies - 1, 0),
          },
          { headers: internalServiceHeaders }
        );
      } catch (error) {
        // Rollback: delete the loan if we can't update availability
        await Loan.findByIdAndDelete(savedLoan._id);
        return res.status(503).json({ message: "Failed to update book availability" });
      }

      // Send borrow confirmation notification (fire and forget)
      try {
        await axios.post(
          `${NOTIFICATION_SERVICE_URL}/api/notifications`,
          {
            userId,
            type: "borrow_confirmation",
            message: `You have successfully borrowed "${book.title}". Due date: ${dueDate.toDateString()}`,
            bookTitle: book.title,
            loanId: savedLoan._id,
          },
          { headers: internalServiceHeaders }
        );
      } catch (error) {
        // Notification failure should not block the borrow operation
        console.error("Failed to send borrow notification:", error.message);
      }

      res.status(201).json(savedLoan);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// GET /active - Get all active (borrowed/overdue) loans (admin/staff only)
router.get("/active", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ message: "Access denied. Admin or staff only." });
    }

    const activeLoans = await Loan.find({
      status: { $in: ["borrowed", "overdue"] },
    }).sort({ dueDate: 1 });

    res.json(activeLoans);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST /return/:loanId - Return a book (admin/staff only)
router.post("/return/:loanId", auth, async (req, res) => {
  try {
    if (req.user.role !== "admin" && req.user.role !== "staff") {
      return res.status(403).json({ message: "Access denied. Only admin or staff can process returns." });
    }

    const loan = await Loan.findById(req.params.loanId);

    if (!loan) {
      return res.status(404).json({ message: "Loan record not found" });
    }

    if (loan.status === "returned") {
      return res.status(400).json({ message: "This book has already been returned" });
    }

    // Update loan status
    loan.status = "returned";
    loan.returnDate = new Date();
    const updatedLoan = await loan.save();

    // Get current book info and increment availableCopies
    try {
      const bookResponse = await axios.get(`${BOOK_SERVICE_URL}/api/books/${loan.bookId}`);
      const book = bookResponse.data;
      const normalizedAvailableCopies = normalizeAvailableCopies(book);

      await axios.patch(
        `${BOOK_SERVICE_URL}/api/books/${loan.bookId}/availability`,
        {
          availableCopies: Math.min(normalizedAvailableCopies + 1, Number(book.totalCopies) || 0),
        },
        { headers: internalServiceHeaders }
      );
    } catch (error) {
      console.error("Failed to update book availability:", error.message);
    }

    // Send return confirmation notification (fire and forget)
    try {
      await axios.post(
        `${NOTIFICATION_SERVICE_URL}/api/notifications`,
        {
          userId: loan.userId,
          type: "return_confirmation",
          message: `You have successfully returned "${loan.bookTitle}".`,
          bookTitle: loan.bookTitle,
          loanId: loan._id,
        },
        { headers: internalServiceHeaders }
      );
    } catch (error) {
      console.error("Failed to send return notification:", error.message);
    }

    res.json(updatedLoan);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /user/:userId - Get all loans for a user (protected)
router.get("/user/:userId", auth, async (req, res) => {
  try {
    if (!canViewUserLoans(req.user, req.params.userId)) {
      return res.status(403).json({ message: "Access denied. You can only view your own loans." });
    }

    const loans = await Loan.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /due-soon - Get loans due within 2 days (internal service only)
router.get("/due-soon", requireInternalService, async (req, res) => {
  try {
    const now = new Date();
    const twoDaysLater = new Date();
    twoDaysLater.setDate(now.getDate() + 2);

    const dueSoonLoans = await Loan.find({
      status: "borrowed",
      dueDate: { $gte: now, $lte: twoDaysLater },
    }).sort({ dueDate: 1 });

    res.json(dueSoonLoans);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /overdue - Get all overdue loans (internal service only)
router.get("/overdue", requireInternalService, async (req, res) => {
  try {
    const now = new Date();

    // Find loans that are borrowed and past due date
    const overdueLoans = await Loan.find({
      status: "borrowed",
      dueDate: { $lt: now },
    }).sort({ dueDate: 1 });

    // Update status to overdue for these loans
    await Loan.updateMany(
      { status: "borrowed", dueDate: { $lt: now } },
      { $set: { status: "overdue" } }
    );

    res.json(overdueLoans);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /:id - Get loan by ID
router.get("/:id", auth, async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: "Loan record not found" });
    }

    if (!canViewUserLoans(req.user, loan.userId.toString())) {
      return res.status(403).json({ message: "Access denied. You can only view your own loans." });
    }

    res.json(loan);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
