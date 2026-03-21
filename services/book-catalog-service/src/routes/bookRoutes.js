const express = require("express");
const { body, validationResult } = require("express-validator");
const Book = require("../models/Book");
const { auth, adminOnly } = require("../middleware/auth");

const router = express.Router();

// GET / - Get all books (public, with optional search and category filters)
router.get("/", async (req, res) => {
  try {
    const { search, category } = req.query;
    let filter = {};

    if (category) {
      filter.category = category;
    }

    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { author: { $regex: search, $options: "i" } },
        { isbn: { $regex: search, $options: "i" } },
      ];
    }

    const books = await Book.find(filter).sort({ createdAt: -1 });
    res.json(books);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// GET /:id - Get book by ID (public)
router.get("/:id", async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// POST / - Add a new book (protected, admin only)
router.post(
  "/",
  auth,
  adminOnly,
  [
    body("title").notEmpty().withMessage("Title is required"),
    body("author").notEmpty().withMessage("Author is required"),
    body("isbn").notEmpty().withMessage("ISBN is required"),
    body("category").notEmpty().withMessage("Category is required"),
    body("totalCopies").optional().isInt({ min: 1 }).withMessage("Total copies must be at least 1"),
    body("publishedYear").optional().isInt({ min: 1000, max: new Date().getFullYear() }).withMessage("Invalid published year"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      // Check if a book with the same ISBN already exists
      const existingBook = await Book.findOne({ isbn: req.body.isbn });
      if (existingBook) {
        return res.status(400).json({ message: "A book with this ISBN already exists" });
      }

      const book = new Book({
        title: req.body.title,
        author: req.body.author,
        isbn: req.body.isbn,
        category: req.body.category,
        description: req.body.description,
        totalCopies: req.body.totalCopies || 1,
        availableCopies: req.body.availableCopies || req.body.totalCopies || 1,
        publishedYear: req.body.publishedYear,
      });

      const savedBook = await book.save();
      res.status(201).json(savedBook);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// PUT /:id - Update a book (protected, admin only)
router.put(
  "/:id",
  auth,
  adminOnly,
  [
    body("title").optional().notEmpty().withMessage("Title cannot be empty"),
    body("author").optional().notEmpty().withMessage("Author cannot be empty"),
    body("isbn").optional().notEmpty().withMessage("ISBN cannot be empty"),
    body("category").optional().notEmpty().withMessage("Category cannot be empty"),
    body("totalCopies").optional().isInt({ min: 1 }).withMessage("Total copies must be at least 1"),
    body("publishedYear").optional().isInt({ min: 1000, max: new Date().getFullYear() }).withMessage("Invalid published year"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const book = await Book.findById(req.params.id);
      if (!book) {
        return res.status(404).json({ message: "Book not found" });
      }

      // If ISBN is being changed, check for duplicates
      if (req.body.isbn && req.body.isbn !== book.isbn) {
        const existingBook = await Book.findOne({ isbn: req.body.isbn });
        if (existingBook) {
          return res.status(400).json({ message: "A book with this ISBN already exists" });
        }
      }

      const updatedBook = await Book.findByIdAndUpdate(
        req.params.id,
        { $set: req.body },
        { new: true, runValidators: true }
      );

      res.json(updatedBook);
    } catch (error) {
      res.status(500).json({ message: "Server error", error: error.message });
    }
  }
);

// PATCH /:id/availability - Update available copies (inter-service, no auth)
router.patch("/:id/availability", async (req, res) => {
  try {
    const { availableCopies } = req.body;

    if (availableCopies === undefined || availableCopies === null) {
      return res.status(400).json({ message: "availableCopies is required" });
    }

    const book = await Book.findById(req.params.id);
    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    if (availableCopies < 0 || availableCopies > book.totalCopies) {
      return res.status(400).json({
        message: `availableCopies must be between 0 and ${book.totalCopies}`,
      });
    }

    book.availableCopies = availableCopies;
    const updatedBook = await book.save();

    res.json(updatedBook);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

// DELETE /:id - Delete a book (protected, admin only)
// router.delete("/:id", /* auth, adminOnly, */ async (req, res) => {

router.delete("/:id", auth, adminOnly, async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    await Book.findByIdAndDelete(req.params.id);
    res.json({ message: "Book deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
