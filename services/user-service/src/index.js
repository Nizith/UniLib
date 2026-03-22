const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const userRoutes = require("./routes/userRoutes");

// Load environment variables
dotenv.config();

const requiredEnv = ["MONGO_URI", "JWT_SECRET", "INTERNAL_SERVICE_TOKEN"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 3001;
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
    max: Number(process.env.RATE_LIMIT_MAX || 200),
    standardHeaders: true,
    legacyHeaders: false,
  })
);
app.use(express.json({ limit: "10kb" }));

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", service: "user-service" });
});

// Routes
app.use("/api/users", userRoutes);

// Connect to MongoDB and start server
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`User service running on port ${PORT}`);
  });
});

module.exports = app;
