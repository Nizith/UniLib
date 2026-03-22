const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const connectDB = require("./config/db");
const bookRoutes = require("./routes/bookRoutes");

const app = express();
const PORT = process.env.PORT || 3002;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const isWildcardCors = corsOrigin === "*";

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: isWildcardCors ? true : corsOrigin,
    credentials: !isWildcardCors,
  })
);
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.RATE_LIMIT_MAX || 300),
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "10kb" }));

// Routes
app.use("/api/books", bookRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "book-catalog-service" });
});

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Book Catalog Service running on port ${PORT}`);
  });
});

module.exports = app;
