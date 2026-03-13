const express = require("express");
const { body, validationResult } = require("express-validator");
const axios = require("axios");
const Loan = require("../models/Loan");
const { auth } = require("../middleware/auth");

const router = express.Router();

const BOOK_SERVICE_URL = process.env.BOOK_SERVICE_URL || "http://localhost:3002";
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || "http://localhost:3004";

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
        await axios.patch(`${BOOK_SERVICE_URL}/api/books/${bookId}/availability`, {
          availableCopies: book.availableCopies - 1,
        });
      } catch (error) {
        // Rollback: delete the loan if we can't update availability
        await Loan.findByIdAndDelete(savedLoan._id);
        return res.status(503).json({ message: "Failed to update book availability" });
      }

      // Send borrow confirmation notification (fire and forget)
      try {
        await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
          userId,
          type: "borrow_confirmation",
          message: `You have successfully borrowed "${book.title}". Due date: ${dueDate.toDateString()}`,
          loanId: savedLoan._id,
        });
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

// POST /return/:loanId - Return a book (protected)
router.post("/return/:loanId", auth, async (req, res) => {
  try {
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

      await axios.patch(`${BOOK_SERVICE_URL}/api/books/${loan.bookId}/availability`, {
        availableCopies: book.availableCopies + 1,
      });
    } catch (error) {
      console.error("Failed to update book availability:", error.message);
    }

    // Send return confirmation notification (fire and forget)
    try {
      await axios.post(`${NOTIFICATION_SERVICE_URL}/api/notifications`, {
        userId: loan.userId,
        type: "return_confirmation",
        message: `You have successfully returned "${loan.bookTitle}".`,
        loanId: loan._id,
      });
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
    const loans = await Loan.find({ userId: req.params.userId }).sort({ createdAt: -1 });
    res.json(loans);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /overdue - Get all overdue loans (for notification service, no auth)
router.get("/overdue", async (req, res) => {
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
router.get("/:id", async (req, res) => {
  try {
    const loan = await Loan.findById(req.params.id);

    if (!loan) {
      return res.status(404).json({ message: "Loan record not found" });
    }

    res.json(loan);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
