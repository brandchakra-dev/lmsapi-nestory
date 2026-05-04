const User = require("../models/User");
const jwt = require("jsonwebtoken");
const { ROLE_PERMISSIONS } = require("../utils/permissions");
const { generateAccessToken, generateRefreshToken } = require("../utils/jwt");
const redisService = require('../services/redis.service');
const emailService = require('../services/email.service');
const OTPUtil = require('../utils/otp.util');

const isProd = process.env.NODE_ENV === "production";

// const cookieOptions = {
//   httpOnly: true,
//   secure: isProd,
//   sameSite: isProd ? "none" : "lax",
//   path: "/",
// };

const cookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "none",
  domain: ".thenestory.in",
  path: "/",
};

// Initialize Redis on server start
(async () => {
  try {
    await redisService.connect();
  } catch (error) {
    console.error('Failed to connect to Redis:', error);
  }
})();

// ==================== EXISTING CODE (DON'T MODIFY) ====================

/* REGISTER */
exports.register = async (req, res, next) => {
  try {
    const { name, email, password, role, phone, assignedManager, isActive } = req.body;

    if (await User.findOne({ email }))
      return res.status(400).json({ message: "Email already exists" });

    const user = await User.create({
      name,
      email,
      password,
      phone,
      role,
      permissions: ROLE_PERMISSIONS[role] || [],
      assignedManager,
      isActive: isActive !== undefined ? isActive : true
    });

    res.status(201).json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        permissions: user.permissions,
        assignedManager: user.assignedManager,
        isActive: user.isActive
      }
    });
  } catch (e) {
    next(e);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).populate('assignedManager', 'name email role');

      // ❌ PEHLE NULL CHECK
      if (!user) {
        return res.status(401).json({
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }

      // ✅ FIR password check
      const isMatch = await user.matchPassword(password);

      if (!isMatch) {
        return res.status(401).json({
          code: "INVALID_CREDENTIALS",
          message: "Invalid email or password"
        });
      }

    if (!user.isActive)
      return res.status(403).json({ message: "Account inactive" });


    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);

    if (!user.refreshTokens.includes(refreshToken)) {
      user.refreshTokens.push(refreshToken);
    }

    await user.save();

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.json({
      token: accessToken,
      refreshToken: refreshToken,
      user: {
        _id: user._id,
        name: user.name,
        role: user.role,
        email: user.email,
        phone:user.phone,
        isActive: user.isActive,
        createdAt:user.createdAt,
        assignedManager:user.assignedManager
      }
    });

  } catch (e) {
    next(e);
  }
};

exports.refreshToken = async (req, res) => {
  try {

    const token =
      req.cookies?.refreshToken ||
      req.body?.refreshToken ||
      req.headers["x-refresh-token"];

    if (!token) {
      return res.status(401).json({
        code: "NO_REFRESH_TOKEN",
        message: "No refresh token"
      });
    }

    const decoded = jwt.verify(
      token,
      process.env.JWT_REFRESH_SECRET
    );

    const user = await User.findById(decoded.id);

    if (!user || !user.refreshTokens.includes(token)) {
      return res.status(401).json({
        code: "INVALID_SESSION",
        message: "Invalid session"
      });
    }

    const newAccessToken = generateAccessToken(user);

    // 🍪 Web → set cookie
    res.cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    });

    // 📱 Mobile → send JSON
    res.json({
      accessToken: newAccessToken
    });

  } catch {
    res.status(401).json({
      code: "SESSION_EXPIRED",
      message: "Session expired"
    });
  }
};

exports.me = async (req, res) => {
  res.json({ user: req.user });
};

exports.logout = async (req, res) => {
  try {
    if (req.user) {
      // 🔥 current refresh token nikaalo
      const token =
        req.cookies?.refreshToken ||
        req.body?.refreshToken ||
        req.headers["x-refresh-token"];

      console.log("🚪 Logout token:", token);

      if (token) {
        // 🔥 sirf ye device ka token remove karo
        req.user.refreshTokens = req.user.refreshTokens.filter(
          (t) => t !== token
        );

        await req.user.save();
      }
    }

    // 🍪 cookies clear
    res.clearCookie("accessToken", cookieOptions);
    res.clearCookie("refreshToken", cookieOptions);

    res.json({ message: "Logged out" });

  } catch (error) {
    console.error("Logout error:", error);
    res.status(500).json({ message: "Logout failed" });
  }
};



// ==================== NEW PRODUCTION-READY FUNCTIONS ====================

/**
 * @desc    Forgot Password - Send OTP
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // ================= VALIDATION =================
    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required"
      });
    }

    // ================= USER CHECK =================
    const user = await User.findOne({ email }).select("name email");

    // Security: don't reveal user existence
    if (!user) {
      return res.status(200).json({
        success: true,
        message:
          "If an account exists with this email, you will receive an OTP"
      });
    }

    // ================= RESEND COOLDOWN CHECK (60 sec) =================
    const resendBlock = await redisService.get(`resend:${email}`);

    if (resendBlock) {
      const timeLeft = Math.ceil(
        (resendBlock.expiresAt - Date.now()) / 1000
      );

      if (timeLeft > 0) {
        return res.status(429).json({
          success: false,
          message: `Please wait ${timeLeft} seconds before requesting a new OTP`,
          waitTime: timeLeft
        });
      }
    }

    // ================= ATTEMPTS CHECK =================
    const attempts = await redisService.getAttempts(`otp:${email}`);

    if (attempts >= 3) {
      return res.status(429).json({
        success: false,
        message: "Too many attempts. Please try again after 1 hour."
      });
    }

    // ================= GENERATE OTP =================
    const { otp, expiresAt } = OTPUtil.generateOTPWithExpiry(6, 10);

    // ================= STORE OTP (10 min) =================
    await redisService.set(
      `otp:${email}`,
      {
        otp: OTPUtil.hashOTP(otp),
        expiresAt,
        attempts: 0,
        email,
        userId: user._id.toString()
      },
      600 // 10 minutes
    );

    // ================= SEND EMAIL =================
    await emailService.sendOTPEmail(email, otp, user.name);

    // ================= SET RESEND COOLDOWN (60 sec) =================
    await redisService.set(
      `resend:${email}`,
      {
        expiresAt: Date.now() + 60 * 1000
      },
      60
    );

    // ================= DEBUG LOG =================
    if (process.env.NODE_ENV !== "production") {
      console.log(`🔐 OTP for ${email}: ${otp}`);
    }

    // ================= RESPONSE =================
    res.json({
      success: true,
      message:
        "If an account exists with this email, you will receive an OTP"
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    next(error);
  }
};

/**
 * @desc    Verify OTP
 * @route   POST /api/auth/verify-otp
 * @access  Public
 */
exports.verifyOTP = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ 
        success: false,
        message: "Email and OTP are required" 
      });
    }

    // Get stored OTP
    const stored = await redisService.get(`otp:${email}`);
    if (!stored) {
      return res.status(400).json({ 
        success: false,
        message: "OTP expired or not found. Please request a new OTP." 
      });
    }

    // Check expiry
    if (stored.expiresAt < Date.now()) {
      await redisService.delete(`otp:${email}`);
      return res.status(400).json({ 
        success: false,
        message: "OTP expired. Please request a new OTP." 
      });
    }

    // Increment and check attempts
    const attempts = await redisService.incrementAttempts(`otp:${email}`);
    if (attempts > 5) {
      await redisService.delete(`otp:${email}`);
      return res.status(429).json({ 
        success: false,
        message: "Too many failed attempts. Please request a new OTP." 
      });
    }

    // Verify OTP
    if (!OTPUtil.verifyOTP(otp, stored.otp)) {
      return res.status(400).json({ 
        success: false,
        message: "Invalid OTP. Please try again.",
        attemptsLeft: 5 - attempts
      });
    }

    // Mark as verified (store a temporary token)
    const verificationToken = jwt.sign(
      { email, purpose: 'password-reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    await redisService.set(`verified:${email}`, {
      verified: true,
      token: verificationToken
    }, 900); // 15 minutes

    res.json({
      success: true,
      message: "OTP verified successfully",
      verificationToken // Send token for next step
    });

  } catch (error) {
    console.error("Verify OTP error:", error);
    next(error);
  }
};

/**
 * @desc    Reset Password
 * @route   POST /api/auth/reset-password
 * @access  Public
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword, verificationToken } = req.body;

    if (!email || !newPassword) {
      return res.status(400).json({ 
        success: false,
        message: "Email and new password are required" 
      });
    }

    // Validate verification token
    if (!verificationToken) {
      return res.status(400).json({ 
        success: false,
        message: "Verification required. Please verify OTP first." 
      });
    }

    try {
      jwt.verify(verificationToken, process.env.JWT_SECRET);
    } catch (tokenError) {
      return res.status(400).json({ 
        success: false,
        message: "Verification expired. Please restart the process." 
      });
    }

    // Check if verified
    const verified = await redisService.get(`verified:${email}`);
    if (!verified || !verified.verified) {
      return res.status(400).json({ 
        success: false,
        message: "OTP not verified. Please verify OTP first." 
      });
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return res.status(400).json({ 
        success: false,
        message: passwordValidation.message 
      });
    }

    // Find and update user
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: "User not found" 
      });
    }

    // Update password (will be hashed by pre-save hook)
    user.password = newPassword;
    
    // Clear all sessions
    user.refreshTokens = [];
    
    await user.save();

    // Clean up Redis
    await redisService.delete(`otp:${email}`);
    await redisService.delete(`verified:${email}`);

    // Log password change
    console.log(`🔐 Password reset successful for: ${email}`);

    // Send confirmation email
    try {
      await emailService.sendPasswordChangeConfirmation(email, user.name);
    } catch (emailError) {
      console.error('Failed to send confirmation email:', emailError);
    }

    res.json({
      success: true,
      message: "Password reset successfully. Please login with your new password.",
    });

  } catch (error) {
    console.error("Reset password error:", error);
    next(error);
  }
};

/**
 * @desc    Resend OTP
 * @route   POST /api/auth/resend-otp
 * @access  Public
 */
exports.resendOTP = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ 
        success: false,
        message: "Email is required" 
      });
    }

    const user = await User.findOne({ email }).select('name email');
    if (!user) {
      return res.status(200).json({ 
        success: true,
        message: "If an account exists, you will receive an OTP" 
      });
    }

    // Check rate limiting
    const lastResend = await redisService.get(`resend:${email}`);
    if (lastResend) {
      const timeLeft = Math.ceil((lastResend.expiresAt - Date.now()) / 1000);
      if (timeLeft > 0) {
        return res.status(429).json({ 
          success: false,
          message: `Please wait ${timeLeft} seconds before resending OTP`,
          waitTime: timeLeft
        });
      }
    }

    // Generate new OTP
    const { otp, expiresAt } = OTPUtil.generateOTPWithExpiry(6, 10);

    // Store in Redis
    await redisService.set(`otp:${email}`, {
      otp: OTPUtil.hashOTP(otp),
      expiresAt,
      attempts: 0,
      email,
      userId: user._id.toString()
    }, 600);

    // Store resend timestamp
    await redisService.set(`resend:${email}`, {
      expiresAt: Date.now() + 60 * 1000 // 1 minute cooldown
    }, 60);

    // Send email
    try {
      await emailService.sendOTPEmail(email, otp, user.name);
    } catch (emailError) {
      console.error('Failed to send email:', emailError);
    }

    if (process.env.NODE_ENV !== 'production') {
      console.log(`📧 Resent OTP for ${email}: ${otp}`);
    }

    res.json({
      success: true,
      message: "OTP resent successfully",
    });

  } catch (error) {
    console.error("Resend OTP error:", error);
    next(error);
  }
};

// Helper function for password validation
function validatePassword(password) {
  if (password.length < 6) {
    return { valid: false, message: "Password must be at least 6 characters long" };
  }
  if (!/[A-Z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one uppercase letter" };
  }
  if (!/[a-z]/.test(password)) {
    return { valid: false, message: "Password must contain at least one lowercase letter" };
  }
  if (!/[0-9]/.test(password)) {
    return { valid: false, message: "Password must contain at least one number" };
  }
  if (!/[!@#$%^&*]/.test(password)) {
    return { valid: false, message: "Password must contain at least one special character (!@#$%^&*)" };
  }
  return { valid: true };
}

