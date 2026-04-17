const jwt = require("jsonwebtoken");
const User = require("../models/User");

exports.protect = async (req, res, next) => {
  try {

    let token = null;

    // ✅ 1. WEB: Cookie Based Auth
    if (req.cookies && req.cookies.accessToken) {
      token = req.cookies.accessToken;
    }

    // ✅ 2. MOBILE: Bearer Token Auth
    if (!token && req.headers.authorization?.startsWith("Bearer ")) {
      token = req.headers.authorization.split(" ")[1];
    }

    if (!token) {
      return res.status(401).json({
        code: "NO_TOKEN",
        message: "Not authenticated"
      });
    }

    // ✅ Verify Token
    let decoded;

    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {

      if (err.name === "TokenExpiredError") {
        return res.status(401).json({
          code: "TOKEN_EXPIRED",
          message: "Access token expired"
        });
      }

      return res.status(401).json({
        code: "INVALID_TOKEN",
        message: "Invalid token"
      });
    }

    // ✅ Find User
    const user = await User.findById(decoded.id).select("-password");

    if (!user) {
      return res.status(401).json({
        code: "USER_NOT_FOUND",
        message: "User not found"
      });
    }

    // ✅ Active Check
    if (!user.isActive) {
      return res.status(403).json({
        code: "ACCOUNT_INACTIVE",
        message: "Your account is inactive. Contact admin."
      });
    }

    // ✅ Attach User
    req.user = user;

    next();

  }catch (err) {

    console.error("Auth middleware error:", err);

    return res.status(500).json({
      code: "AUTH_FAILED",
      message: "Authentication failed"
    });

  }
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user)
      return res.status(401).json({ message: "Not authenticated" });

    if (!roles.includes(req.user.role))
      return res.status(403).json({ message: "Access denied" });

    next();
  };
};
