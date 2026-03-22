const express = require("express");
const axios = require("axios");
const { body, validationResult } = require("express-validator");
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const { INTERNAL_SERVICE_HEADER, requireInternalService } = require("../middleware/serviceAuth");
const { sendNotificationEmail } = require("../utils/emailService");

const router = express.Router();

const LOAN_SERVICE_URL =
  process.env.LOAN_SERVICE_URL || "http://localhost:3003";
const USER_SERVICE_URL =
  process.env.USER_SERVICE_URL || "http://localhost:3001";
const internalServiceHeaders = process.env.INTERNAL_SERVICE_TOKEN
  ? { [INTERNAL_SERVICE_HEADER]: process.env.INTERNAL_SERVICE_TOKEN }
  : {};
const canManageNotifications = (requestUser, resourceUserId) =>
  requestUser && (requestUser.id === resourceUserId || requestUser.role === "admin" || requestUser.role === "staff");
const NOTIFICATION_TYPES = [
  "borrow_confirmation",
  "borrow_activity_alert",
  "return_confirmation",
  "due_reminder",
  "overdue_alert",
];
const BORROW_CONFIRMATION_DUE_DATE_REGEX = /Due date:\s*(.+)/i;

const emitToUser = (req, userId, notification) => {
  const io = req.app.get("io");
  const connectedUsers = req.app.get("connectedUsers");

  if (io && connectedUsers && connectedUsers.has(userId)) {
    for (const socketId of connectedUsers.get(userId)) {
      io.to(socketId).emit("new-notification", notification);
    }
  }
};

const createNotification = async ({ userId, type, message, bookTitle, loanId }) => {
  const notification = new Notification({
    userId,
    type,
    message,
    bookTitle,
    loanId,
  });

  await notification.save();
  return notification;
};

const fetchUserById = async (userId) => {
  const userResponse = await axios.get(`${USER_SERVICE_URL}/api/users/${userId}`, {
    headers: internalServiceHeaders,
  });

  return userResponse.data;
};

const fetchStaffAndAdmins = async () => {
  const usersResponse = await axios.get(`${USER_SERVICE_URL}/api/users/internal/staff-admins`, {
    headers: internalServiceHeaders,
  });

  return usersResponse.data;
};

// POST / - Create a notification (inter-service communication only)
router.post(
  "/",
  requireInternalService,
  [
    body("userId").notEmpty().withMessage("userId is required"),
    body("type").isIn(NOTIFICATION_TYPES).withMessage("Invalid notification type"),
    body("message").notEmpty().withMessage("message is required"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { userId, type, message, bookTitle } = req.body;
      const notification = await createNotification({
        userId,
        type,
        message,
        bookTitle,
        loanId: req.body.loanId,
      });
      emitToUser(req, userId, notification);

      // Send email notification (fire and forget)
      try {
        const user = await fetchUserById(userId);
        const userEmail = user.email;
        const userName = user.name || "User";
        // Extract due date from message if present
        const dueDateMatch = message.match(BORROW_CONFIRMATION_DUE_DATE_REGEX);
        const dueDate = dueDateMatch ? dueDateMatch[1] : null;
        if (userEmail) {
          sendNotificationEmail(userEmail, type, bookTitle || "a book", dueDate, userName);
        }
      } catch (err) {
        console.error("Failed to fetch user for email:", err.message);
      }

      if (type === "borrow_confirmation") {
        try {
          const borrower = await fetchUserById(userId);
          const staffAndAdmins = await fetchStaffAndAdmins();
          const dueDateMatch = message.match(BORROW_CONFIRMATION_DUE_DATE_REGEX);
          const dueDate = dueDateMatch ? dueDateMatch[1] : null;
          const borrowerName = borrower.name || borrower.email || "A library member";

          for (const recipient of staffAndAdmins) {
            if (!recipient?._id || recipient._id.toString() === userId.toString()) {
              continue;
            }

            const alertMessage = `${borrowerName} borrowed "${bookTitle || "a book"}"${
              dueDate ? ` (due ${dueDate})` : ""
            }.`;

            const staffNotification = await createNotification({
              userId: recipient._id.toString(),
              type: "borrow_activity_alert",
              message: alertMessage,
              bookTitle,
              loanId: req.body.loanId,
            });

            emitToUser(req, recipient._id.toString(), staffNotification);

            if (recipient.email) {
              sendNotificationEmail(
                recipient.email,
                "borrow_activity_alert",
                bookTitle || "a book",
                dueDate,
                recipient.name || recipient.email || "Staff member",
                { borrowerName }
              );
            }
          }
        } catch (err) {
          console.error("Failed to notify staff/admin about borrow activity:", err.message);
        }
      }

      res.status(201).json({
        message: "Notification created successfully",
        notification,
      });
    } catch (error) {
      console.error("Error creating notification:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /user/:userId - Get all notifications for a user (protected)
router.get("/user/:userId", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!canManageNotifications(req.user, userId)) {
      return res.status(403).json({ message: "Access denied. You can only view your own notifications." });
    }

    const notifications = await Notification.find({ userId }).sort({
      createdAt: -1,
    });

    res.status(200).json(notifications);
  } catch (error) {
    console.error("Error fetching notifications:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /:id/read - Mark notification as read (protected)
router.patch("/:id/read", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (!canManageNotifications(req.user, notification.userId.toString())) {
      return res.status(403).json({ message: "Access denied. You can only update your own notifications." });
    }

    const updatedNotification = await Notification.findByIdAndUpdate(
      id,
      { read: true },
      { new: true }
    );

    res.status(200).json({
      message: "Notification marked as read",
      notification: updatedNotification,
    });
  } catch (error) {
    console.error("Error marking notification as read:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// DELETE /:id - Delete a notification (protected)
router.delete("/:id", auth, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await Notification.findById(id);

    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }

    if (!canManageNotifications(req.user, notification.userId.toString())) {
      return res.status(403).json({ message: "Access denied. You can only delete your own notifications." });
    }

    await Notification.findByIdAndDelete(id);

    res.status(200).json({
      message: "Notification deleted successfully",
    });
  } catch (error) {
    console.error("Error deleting notification:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /user/:userId/read-all - Mark all notifications as read (protected)
router.patch("/user/:userId/read-all", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!canManageNotifications(req.user, userId)) {
      return res.status(403).json({ message: "Access denied. You can only update your own notifications." });
    }

    const result = await Notification.updateMany(
      { userId, read: false },
      { read: true }
    );

    res.status(200).json({
      message: `${result.modifiedCount} notification(s) marked as read`,
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /user/:userId/unread-count - Get unread notification count (protected)
router.get("/user/:userId/unread-count", auth, async (req, res) => {
  try {
    const { userId } = req.params;

    if (!canManageNotifications(req.user, userId)) {
      return res.status(403).json({ message: "Access denied. You can only view your own notifications." });
    }

    const count = await Notification.countDocuments({ userId, read: false });

    res.status(200).json({ unreadCount: count });
  } catch (error) {
    console.error("Error fetching unread count:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// POST /check-overdue - Trigger overdue check (internal only, for cron/scheduled tasks)
router.post("/check-overdue", requireInternalService, async (req, res) => {
  try {
    // Fetch overdue loans from Loan Service
    const loansResponse = await axios.get(`${LOAN_SERVICE_URL}/api/loans/overdue`, {
      headers: internalServiceHeaders,
    });
    const overdueLoans = loansResponse.data;

    const notifications = [];

    for (const loan of overdueLoans) {
      // Skip if notification already sent for this loan
      const existing = await Notification.findOne({
        loanId: loan._id,
        type: "overdue_alert",
      });
      if (existing) continue;

      // Fetch user info from User Service
      let userName = "User";
      let userEmail = null;
      try {
        const userResponse = await axios.get(`${USER_SERVICE_URL}/api/users/${loan.userId}`, {
          headers: internalServiceHeaders,
        });
        userName = userResponse.data.name || "User";
        userEmail = userResponse.data.email;
      } catch (err) {
        console.error(
          `Error fetching user ${loan.userId}:`,
          err.message
        );
      }

      // Create overdue alert notification
      const notification = await createNotification({
        userId: loan.userId,
        type: "overdue_alert",
        message: `Dear ${userName}, the book "${loan.bookTitle}" is overdue. Please return it as soon as possible.`,
        bookTitle: loan.bookTitle,
        loanId: loan._id,
      });
      notifications.push(notification);
      emitToUser(req, loan.userId, notification);

      // Send email notification
      if (userEmail) {
        sendNotificationEmail(userEmail, "overdue_alert", loan.bookTitle, null, userName);
      }
    }

    res.status(200).json({
      message: `Overdue check completed. ${notifications.length} notification(s) created.`,
      notifications,
    });
  } catch (error) {
    console.error("Error during overdue check:", error.message);
    res.status(500).json({ message: "Server error during overdue check" });
  }
});

// POST /check-due-reminders - Trigger due date reminder check (internal only, for cron/scheduled tasks)
router.post("/check-due-reminders", requireInternalService, async (req, res) => {
  try {
    // Fetch loans due within 2 days from Loan Service
    const loansResponse = await axios.get(`${LOAN_SERVICE_URL}/api/loans/due-soon`, {
      headers: internalServiceHeaders,
    });
    const dueSoonLoans = loansResponse.data;

    const notifications = [];

    for (const loan of dueSoonLoans) {
      // Skip if due reminder already sent for this loan
      const existing = await Notification.findOne({
        loanId: loan._id,
        type: "due_reminder",
      });
      if (existing) continue;

      // Fetch user info from User Service
      let userName = "User";
      let userEmail = null;
      try {
        const userResponse = await axios.get(`${USER_SERVICE_URL}/api/users/${loan.userId}`, {
          headers: internalServiceHeaders,
        });
        userName = userResponse.data.name || "User";
        userEmail = userResponse.data.email;
      } catch (err) {
        console.error(
          `Error fetching user ${loan.userId}:`,
          err.message
        );
      }

      const dueDate = new Date(loan.dueDate).toDateString();

      // Create due reminder notification
      const notification = await createNotification({
        userId: loan.userId,
        type: "due_reminder",
        message: `Dear ${userName}, the book "${loan.bookTitle}" is due on ${dueDate}. Please return it on time.`,
        bookTitle: loan.bookTitle,
        loanId: loan._id,
      });
      notifications.push(notification);
      emitToUser(req, loan.userId, notification);

      // Send email notification
      if (userEmail) {
        sendNotificationEmail(userEmail, "due_reminder", loan.bookTitle, dueDate, userName);
      }
    }

    res.status(200).json({
      message: `Due reminder check completed. ${notifications.length} notification(s) created.`,
      notifications,
    });
  } catch (error) {
    console.error("Error during due reminder check:", error.message);
    res.status(500).json({ message: "Server error during due reminder check" });
  }
});

module.exports = router;
