const express = require("express");
const { body, validationResult } = require("express-validator");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const router = express.Router();
const SELF_REGISTER_ROLES = ["student", "staff"];
const PROFILE_UPDATABLE_ROLES = ["student", "staff", "admin"];
const STAFF_MANAGE_ROLES = ["staff", "admin"];
const ADMIN_MANAGEABLE_ROLES = ["student", "staff"];
const ADMIN_BOOTSTRAP_HEADER = "x-admin-bootstrap-key";

const isStaffOrAdmin = (role) => STAFF_MANAGE_ROLES.includes(role);
const isAdmin = (role) => role === "admin";
const normalizeRole = (role = "") => role.toString().trim().toLowerCase();

const buildAuthResponse = (user) => {
  const token = jwt.sign(
    { id: user._id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "24h" }
  );

  return {
    token,
    user: {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      membershipStatus: user.membershipStatus,
    },
  };
};

// POST /register-admin - Create admin user (Postman/bootstrap only)
router.post(
  "/register-admin",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").trim().isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      const configuredBootstrapKey = process.env.ADMIN_BOOTSTRAP_KEY;
      if (!configuredBootstrapKey) {
        return res.status(500).json({
          message: "ADMIN_BOOTSTRAP_KEY is not configured on the server",
        });
      }

      const providedBootstrapKey = req.header(ADMIN_BOOTSTRAP_HEADER);
      if (!providedBootstrapKey || providedBootstrapKey !== configuredBootstrapKey) {
        return res.status(403).json({
          message: "Invalid admin bootstrap key",
        });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, password } = req.body;
      const email = req.body.email.toLowerCase();

      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const user = new User({
        name,
        email,
        password: hashedPassword,
        role: "admin",
        membershipStatus: "active",
      });

      await user.save();

      res.status(201).json(buildAuthResponse(user));
    } catch (error) {
      console.error("Register admin error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /register - Register a new user
router.post(
  "/register",
  [
    body("name").trim().notEmpty().withMessage("Name is required"),
    body("email").trim().isEmail().withMessage("Please provide a valid email"),
    body("password")
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
    body("role")
      .optional()
      .isIn(SELF_REGISTER_ROLES)
      .withMessage("Role must be either student or staff"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const { name, password } = req.body;
      const email = req.body.email.toLowerCase();
      const role = req.body.role || "student";

      // Check if user already exists
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ message: "User already exists" });
      }

      // Hash the password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // Create new user
      const user = new User({
        name,
        email,
        password: hashedPassword,
        role,
      });

      await user.save();

      res.status(201).json(buildAuthResponse(user));
    } catch (error) {
      console.error("Register error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// POST /login - Login user
router.post(
  "/login",
  [
    body("email").trim().isEmail().withMessage("Please provide a valid email"),
    body("password").notEmpty().withMessage("Password is required"),
  ],
  async (req, res) => {
    try {
      // Check for validation errors
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const password = req.body.password;
      const email = req.body.email.toLowerCase();

      // Find user by email
      const user = await User.findOne({ email });
      if (!user) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      // Compare passwords
      const isMatch = await bcrypt.compare(password, user.password);
      if (!isMatch) {
        return res.status(400).json({ message: "Invalid credentials" });
      }

      if (user.membershipStatus === "suspended") {
        return res.status(403).json({
          message: "Your membership is suspended. Please contact library staff.",
        });
      }

      res.json(buildAuthResponse(user));
    } catch (error) {
      console.error("Login error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /profile - Get current user profile (protected)
router.get("/profile", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /profile - Update current user profile (protected)
router.put(
  "/profile",
  auth,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().trim().isEmail().withMessage("Please provide a valid email"),
    body("role")
      .optional()
      .isIn(PROFILE_UPDATABLE_ROLES)
      .withMessage("Role must be student, staff, or admin"),
    body("membershipStatus")
      .optional()
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Invalid membership status"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const requestedRoleUpdate = Object.prototype.hasOwnProperty.call(req.body, "role");
      const requestedMembershipUpdate = Object.prototype.hasOwnProperty.call(
        req.body,
        "membershipStatus"
      );

      if ((requestedRoleUpdate || requestedMembershipUpdate) && req.user.role !== "admin") {
        return res.status(403).json({
          message: "Only admins can edit role and membership status",
        });
      }

      const updates = {};

      if (typeof req.body.name === "string") {
        updates.name = req.body.name;
      }

      if (typeof req.body.email === "string") {
        const normalizedEmail = req.body.email.toLowerCase();

        if (normalizedEmail !== user.email) {
          const existingUser = await User.findOne({ email: normalizedEmail, _id: { $ne: user._id } });
          if (existingUser) {
            return res.status(400).json({ message: "Email is already in use" });
          }
        }

        updates.email = normalizedEmail;
      }

      if (req.body.role) {
        updates.role = req.body.role;
      }

      if (req.body.membershipStatus) {
        updates.membershipStatus = req.body.membershipStatus;
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields provided for update" });
      }

      const updatedUser = await User.findByIdAndUpdate(
        req.user.id,
        { $set: updates },
        { new: true, runValidators: true }
      ).select("-password");

      res.json({
        message: "Profile updated successfully",
        user: {
          id: updatedUser._id,
          name: updatedUser.name,
          email: updatedUser.email,
          role: updatedUser.role,
          membershipStatus: updatedUser.membershipStatus,
          createdAt: updatedUser.createdAt,
        },
      });
    } catch (error) {
      console.error("Update profile error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /profile - Delete current user profile (protected)
router.delete("/profile", auth, async (req, res) => {
  try {
    const deletedUser = await User.findByIdAndDelete(req.user.id).select("-password");

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "Profile deleted successfully" });
  } catch (error) {
    console.error("Delete profile error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /profile/change-password - Change current user password (protected)
router.patch(
  "/profile/change-password",
  auth,
  [
    body("currentPassword").notEmpty().withMessage("Current password is required"),
    body("newPassword")
      .isLength({ min: 6 })
      .withMessage("New password must be at least 6 characters"),
    body("confirmNewPassword")
      .notEmpty()
      .withMessage("Please confirm your new password")
      .custom((value, { req }) => value === req.body.newPassword)
      .withMessage("New password and confirm password do not match"),
  ],
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const user = await User.findById(req.user.id);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const { currentPassword, newPassword } = req.body;
      const isCurrentMatch = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentMatch) {
        return res.status(400).json({ message: "Current password is incorrect" });
      }

      const isSameAsCurrent = await bcrypt.compare(newPassword, user.password);
      if (isSameAsCurrent) {
        return res.status(400).json({ message: "New password must be different from current password" });
      }

      const salt = await bcrypt.genSalt(10);
      user.password = await bcrypt.hash(newPassword, salt);
      await user.save();

      res.json({ message: "Password changed successfully" });
    } catch (error) {
      console.error("Change password error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /verify-token - Verify token and return current user payload (protected)
router.get("/verify-token", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      valid: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        membershipStatus: user.membershipStatus,
      },
    });
  } catch (error) {
    console.error("Verify token error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /students - List all students (staff/admin only)
router.get("/students", auth, async (req, res) => {
  try {
    if (!isStaffOrAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only staff or admin can view students" });
    }

    const students = await User.find({ role: { $regex: "^student$", $options: "i" } })
      .select("name email role membershipStatus createdAt")
      .sort({ createdAt: -1 });

    res.json(students);
  } catch (error) {
    console.error("Get students error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PATCH /students/:id/membership - Update student membership (staff/admin only)
router.patch(
  "/students/:id/membership",
  auth,
  [
    body("membershipStatus")
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Invalid membership status"),
  ],
  async (req, res) => {
    try {
      if (!isStaffOrAdmin(req.user.role)) {
        return res.status(403).json({ message: "Only staff or admin can update membership" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const student = await User.findById(req.params.id);
      if (!student) {
        return res.status(404).json({ message: "Student not found" });
      }

      if (normalizeRole(student.role) !== "student") {
        return res.status(400).json({ message: "Only student membership can be updated" });
      }

      student.membershipStatus = req.body.membershipStatus;
      await student.save();

      res.json({
        message: "Student membership updated successfully",
        student: {
          id: student._id,
          name: student.name,
          email: student.email,
          role: student.role,
          membershipStatus: student.membershipStatus,
          createdAt: student.createdAt,
        },
      });
    } catch (error) {
      console.error("Update student membership error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// GET /members - List staff and students (admin only)
router.get("/members", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only admin can view members" });
    }

    const members = await User.find({
      role: { $in: ["student", "staff", "Student", "Staff"] },
    })
      .select("name email role membershipStatus createdAt")
      .sort({ createdAt: -1 });

    res.json(members);
  } catch (error) {
    console.error("Get members error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// PUT /members/:id - Update staff/student details (admin only)
router.put(
  "/members/:id",
  auth,
  [
    body("name").optional().trim().notEmpty().withMessage("Name cannot be empty"),
    body("email").optional().trim().isEmail().withMessage("Please provide a valid email"),
    body("role")
      .optional()
      .isIn(ADMIN_MANAGEABLE_ROLES)
      .withMessage("Role must be student or staff"),
    body("membershipStatus")
      .optional()
      .isIn(["active", "inactive", "suspended"])
      .withMessage("Invalid membership status"),
    body("password")
      .optional({ values: "falsy" })
      .isLength({ min: 6 })
      .withMessage("Password must be at least 6 characters"),
  ],
  async (req, res) => {
    try {
      if (!isAdmin(req.user.role)) {
        return res.status(403).json({ message: "Only admin can update members" });
      }

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
      }

      const member = await User.findById(req.params.id);
      if (!member) {
        return res.status(404).json({ message: "Member not found" });
      }

      if (!ADMIN_MANAGEABLE_ROLES.includes(normalizeRole(member.role))) {
        return res.status(400).json({ message: "Only student/staff accounts can be edited here" });
      }

      if (typeof req.body.name === "string") {
        member.name = req.body.name;
      }

      if (typeof req.body.email === "string") {
        const normalizedEmail = req.body.email.toLowerCase();
        if (normalizedEmail !== member.email) {
          const existingUser = await User.findOne({
            email: normalizedEmail,
            _id: { $ne: member._id },
          });

          if (existingUser) {
            return res.status(400).json({ message: "Email is already in use" });
          }
        }
        member.email = normalizedEmail;
      }

      if (req.body.role) {
        member.role = req.body.role;
      }

      if (req.body.membershipStatus) {
        member.membershipStatus = req.body.membershipStatus;
      }

      if (typeof req.body.password === "string" && req.body.password.trim()) {
        const salt = await bcrypt.genSalt(10);
        member.password = await bcrypt.hash(req.body.password, salt);
      }

      await member.save();

      res.json({
        message: "Member updated successfully",
        member: {
          id: member._id,
          name: member.name,
          email: member.email,
          role: member.role,
          membershipStatus: member.membershipStatus,
          createdAt: member.createdAt,
        },
      });
    } catch (error) {
      console.error("Update member error:", error.message);
      res.status(500).json({ message: "Server error" });
    }
  }
);

// DELETE /members/:id - Delete staff/student account (admin only)
router.delete("/members/:id", auth, async (req, res) => {
  try {
    if (!isAdmin(req.user.role)) {
      return res.status(403).json({ message: "Only admin can delete members" });
    }

    const member = await User.findById(req.params.id);
    if (!member) {
      return res.status(404).json({ message: "Member not found" });
    }

    if (!ADMIN_MANAGEABLE_ROLES.includes(normalizeRole(member.role))) {
      return res.status(400).json({ message: "Only student/staff accounts can be deleted here" });
    }

    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Member deleted successfully" });
  } catch (error) {
    console.error("Delete member error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

// GET /:id - Get user by ID (for inter-service communication)
router.get("/:id", async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select("-password");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Get user error:", error.message);
    res.status(500).json({ message: "Server error" });
  }
});

module.exports = router;
