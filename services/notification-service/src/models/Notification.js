const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
  },
  type: {
    type: String,
    enum: [
      "borrow_confirmation",
      "borrow_activity_alert",
      "return_confirmation",
      "due_reminder",
      "overdue_alert",
    ],
    required: true,
  },
  message: {
    type: String,
    required: true,
  },
  bookTitle: {
    type: String,
  },
  loanId: {
    type: String,
  },
  read: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Notification", notificationSchema);
