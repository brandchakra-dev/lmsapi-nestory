const express = require("express");
const router = express.Router();
const authCtrl = require("../controllers/authController");
const { protect } = require("../middleware/authMiddleware");

// ==================== PUBLIC ROUTES - NO RATE LIMITING ====================
router.post("/login", authCtrl.login);
router.post("/register", authCtrl.register);
router.post("/forgot-password", authCtrl.forgotPassword);
router.post("/verify-otp", authCtrl.verifyOTP);
router.post("/reset-password", authCtrl.resetPassword);
router.post("/resend-otp", authCtrl.resendOTP);

// ==================== TOKEN ROUTES ====================
router.post("/refresh", authCtrl.refreshToken);

// ==================== PROTECTED ROUTES ====================
router.post("/logout", protect, authCtrl.logout);
router.get("/me", protect, authCtrl.me);

module.exports = router;