const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const dotenv = require("dotenv");
const cron = require("node-cron");
const axios = require("axios");
const { Server } = require("socket.io");
const connectDB = require("./config/db");
const notificationRoutes = require("./routes/notificationRoutes");

dotenv.config();

const requiredEnv = ["MONGO_URI", "JWT_SECRET", "INTERNAL_SERVICE_TOKEN"];
const missingEnv = requiredEnv.filter((key) => !process.env[key]);

if (missingEnv.length > 0) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3004;
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:3000";
const isWildcardCors = corsOrigin === "*";

// Socket.IO setup with CORS
const io = new Server(server, {
  cors: {
    origin: isWildcardCors ? true : corsOrigin,
    methods: ["GET", "POST"],
  },
});

// Track connected users: userId -> Set of socket IDs
const connectedUsers = new Map();

io.on("connection", (socket) => {
  console.log("Socket connected:", socket.id);

  // Client sends userId after connecting
  socket.on("register", (userId) => {
    if (!connectedUsers.has(userId)) {
      connectedUsers.set(userId, new Set());
    }
    connectedUsers.get(userId).add(socket.id);
    socket.userId = userId;
    console.log(`User ${userId} registered on socket ${socket.id}`);
  });

  socket.on("disconnect", () => {
    if (socket.userId && connectedUsers.has(socket.userId)) {
      connectedUsers.get(socket.userId).delete(socket.id);
      if (connectedUsers.get(socket.userId).size === 0) {
        connectedUsers.delete(socket.userId);
      }
    }
    console.log("Socket disconnected:", socket.id);
  });
});

// Make io accessible to routes
app.set("io", io);
app.set("connectedUsers", connectedUsers);

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

// Connect to MongoDB
connectDB();

// Routes
app.use("/api/notifications", notificationRoutes);

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", service: "notification-service" });
});

// Start server
server.listen(PORT, () => {
  console.log(`Notification Service running on port ${PORT}`);

  // Schedule overdue check - runs every day at 8:00 AM
  cron.schedule("0 8 * * *", async () => {
    console.log("Running scheduled overdue check...");
    try {
      const res = await axios.post(
        `http://localhost:${PORT}/api/notifications/check-overdue`,
        {},
        {
          headers: {
            "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN,
          },
        }
      );
      console.log("Overdue check result:", res.data.message);
    } catch (error) {
      console.error("Scheduled overdue check failed:", error.message);
    }
  });

  // Schedule due reminder check - runs every day at 9:00 AM
  cron.schedule("0 9 * * *", async () => {
    console.log("Running scheduled due reminder check...");
    try {
      const res = await axios.post(
        `http://localhost:${PORT}/api/notifications/check-due-reminders`,
        {},
        {
          headers: {
            "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN,
          },
        }
      );
      console.log("Due reminder check result:", res.data.message);
    } catch (error) {
      console.error("Scheduled due reminder check failed:", error.message);
    }
  });

  console.log("Cron jobs scheduled: overdue check (8:00 AM), due reminders (9:00 AM)");
});

module.exports = { app, server, io };
