const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const loanRoutes = require("./routes/loanRoutes");

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// Connect to MongoDB
connectDB();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use("/api/loans", loanRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "loan-service" });
});

// Start server
app.listen(PORT, () => {
  console.log(`Loan Service running on port ${PORT}`);
});
