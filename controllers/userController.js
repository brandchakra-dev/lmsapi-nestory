const User = require('../models/User');

exports.savePushToken = async (req, res) => {
  try {
    const { token } = req.body;

    await User.findByIdAndUpdate(req.user.id, {
      pushToken: token,
    });

    res.json({ success: true });
  } catch (error) {
    console.error("Save push token error:", error);
    res.status(500).json({ message: "Failed to save push token" });
  }
};

/* =====================================================
   GET ALL USERS (With role-based filtering)
   ===================================================== */
exports.getAll = async (req, res, next) => {
  try {
    let query = {};

      // 1️⃣ If frontend passes ?role=manager or ?role=executive
      if (req.query.role) {
        query.role = req.query.role;
      }

    // -------- SUPERADMIN --------
    if (req.user.role === "superadmin") {
      // no filter → see all
    }

 /* ===============================
       ADMIN
       - Cannot see superadmin
       - But allow query.role from UI
    ================================ */
    if (req.user.role === "admin") {
      if (query.role) {
        // allow specific role filter
        if (query.role === "superadmin") {
          return res.status(403).json({ message: "Admin cannot access superadmin list" });
        }
      } else {
        query.role = { $ne: "superadmin" };
      }
    }

    // -------- MANAGER --------
    if (req.user.role === "manager") {
      query.role = "executive";         // only see executives
      query.assignedManager = req.user._id; // only own executives
    }

    // -------- EXECUTIVE --------
    if (req.user.role === "executive") {
      return res.status(403).json({ message: "Access denied" });
    }

    const users = await User.find(query)
      .select("-password")
      .populate("assignedManager", "name email")
      .sort({ createdAt: -1 });

    res.json(users);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   GET SINGLE USER
   ===================================================== */

exports.getById = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select("-password")
      .populate("assignedManager", "name email");

    if (!user) return res.status(404).json({ message: "User not found" });

    // ADMIN cannot view superadmin
    if (req.user.role === "admin" && user.role === "superadmin") {
      return res.status(403).json({ message: "Access denied" });
    }

    // MANAGER can only view own executives
    if (req.user.role === "manager") {
      if (user.role !== "executive" || user.assignedManager?._id.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Access denied" });
      }
    }

    // EXECUTIVE can only view self
    if (req.user.role === "executive" && req.user._id.toString() !== req.params.id) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.json(user);

  } catch (err) {
    next(err);
  }
};

/* =====================================================
   CREATE USER
   ===================================================== */
   exports.create = async (req, res, next) => {
    try {
      const { name, email, password, confirmPassword, role, phone, assignedManager, isActive } = req.body;
  
      // ✅ Enhanced role-based permission checks
      // Manager can only create executives
      if (req.user.role === "manager" && role !== "executive") {
        return res.status(403).json({
          success: false,
          message: "Managers can only create executive users."
        });
      }
  
      // Admin cannot create superadmin
      if (req.user.role === "admin" && role === "superadmin") {
        return res.status(403).json({
          success: false,
          message: "Admin cannot create superadmin users."
        });
      }
  
      // ✅ EXECUTIVE REQUIRED RULE with enhanced validation
      if (role === "executive") {
        if (!assignedManager) {
          return res.status(400).json({
            success: false,
            message: "Executive must be assigned to a Manager."
          });
        }
        
        // Validate that assignedManager exists and is actually a manager
        const managerExists = await User.findOne({ 
          _id: assignedManager, 
          role: "manager",
          isActive: true 
        });
        
        if (!managerExists) {
          return res.status(400).json({
            success: false,
            message: "Selected manager does not exist or is not active."
          });
        }
  
        // Auto-assign manager if current user is manager creating executive
        if (req.user.role === "manager") {
          req.body.assignedManager = req.user._id;
        }
      } else {
        // Clear assignedManager for non-executive roles
        req.body.assignedManager = null;
      }
  
      // ✅ Basic validations
      if (!name || !name.trim()) {
        return res.status(400).json({ 
          success: false,
          message: "Name is required." 
        });
      }
  
      if (!email || !email.trim()) {
        return res.status(400).json({ 
          success: false,
          message: "Email is required." 
        });
      }
  
      // Email format validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid email address."
        });
      }
  
      if (!password) {
        return res.status(400).json({ 
          success: false,
          message: "Password is required." 
        });
      }
  
      if (password !== confirmPassword) {
        return res.status(400).json({ 
          success: false,
          message: "Passwords do not match." 
        });
      }
  
      if (password.length < 6) {
        return res.status(400).json({ 
          success: false,
          message: "Password must be at least 6 characters long." 
        });
      }
  
      // Phone validation (if provided)
      if (phone && !/^\d{10}$/.test(phone.replace(/\D/g, ""))) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid 10-digit phone number."
        });
      }
  
      // ✅ Prevent duplicate email
      const existingUser = await User.findOne({ email: email.toLowerCase().trim() });
      if (existingUser) {
        return res.status(409).json({ 
          success: false,
          message: "User with this email already exists." 
        });
      }
  
      // ✅ CREATE USER
      const userData = {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        password,
        role: role || "executive",
        phone: phone ? phone.replace(/\D/g, "") : null,
        assignedManager: assignedManager || null,
        isActive: isActive !== undefined ? isActive : true,
        createdBy: req.user._id // Track who created the user
      };
  
      const user = await User.create(userData);
  
      // ✅ Return user without password
      const output = await User.findById(user._id)
        .select("-password")
        .populate("assignedManager", "name email phone role");
  
      res.status(201).json({
        success: true,
        message: "User created successfully.",
        user: output
      });
  
    } catch (err) {
      console.error("User creation error:", err);
      
      // Handle duplicate key errors
      if (err.code === 11000) {
        return res.status(409).json({
          success: false,
          message: "User with this email already exists."
        });
      }
  
      // Handle validation errors
      if (err.name === 'ValidationError') {
        const errors = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
          success: false,
          message: "Validation failed.",
          errors
        });
      }
  
      next(err);
    }
  };
  
  exports.update = async (req, res, next) => {
    try {
      const { name, email, phone, role, assignedManager, isActive, password } = req.body;
  
      const user = await User.findById(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
  
      /* ---------- PERMISSIONS ---------- */
      if (req.user.role === "admin" && user.role === "superadmin")
        return res.status(403).json({ message: "Cannot modify superadmin" });
  
      if (req.user.role === "manager") {
        if (
          user.role !== "executive" || user.assignedManager?._id.toString() !== req.user._id.toString()
        ) {
          return res.status(403).json({ message: "Access denied" });
        }
      }
  
      if (req.user.role === "executive" && req.user._id.toString() !== req.params.id)
        return res.status(403).json({ message: "Access denied" });
  
      /* ---------- BASIC UPDATES ---------- */
      if (name) user.name = name;
      if (email) user.email = email;
      if (phone) user.phone = phone;
  
      /* ---------- ROLE UPDATE ---------- */
      if (role) {
        if (!["superadmin", "admin"].includes(req.user.role)) {
          return res.status(403).json({ message: "Role change not allowed" });
        }
        user.role = role;
      }
  
  /* ---------- ASSIGNED MANAGER (SAFE VERSION) ---------- */
if (user.role === "executive") {

  // ✅ Manager assigning his executive
  if (req.user.role === "manager") {
    user.assignedManager = req.user._id;
  }

  // ✅ Admin / superadmin assigning
  if (["admin", "superadmin"].includes(req.user.role)) {

    // ⭐ ONLY update if field provided
    if (assignedManager !== undefined) {

      // empty → unassign
      if (!assignedManager) {
        user.assignedManager = null;
      } else {
        const managerExists = await User.findOne({
          _id: assignedManager,
          role: "manager",
          isActive: true
        });

        if (!managerExists) {
          return res.status(400).json({
            message: "Selected manager is invalid or inactive"
          });
        }

        user.assignedManager = assignedManager;
      }

    }
  }

} else {
  user.assignedManager = null;
}
      
  
      /* ---------- ACTIVE STATUS ---------- */
      if (isActive !== undefined) {
        user.isActive = isActive;
      }
  
      /* ---------- PASSWORD ---------- */
      if (password) {
        if (password.length < 6) {
          return res.status(400).json({ message: "Password must be at least 6 characters" });
        }
        user.password = password; // hashed by pre-save
      }
  
      await user.save();
  
      const updated = await User.findById(user._id)
        .select("-password")
        .populate("assignedManager", "name email");
  
      res.json({ message: "Updated successfully", user: updated });
  
    } catch (err) {
      next(err);
    }
  };
  
/* =====================================================
   DELETE USER
   ===================================================== */
exports.remove = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) return res.status(404).json({ message: "User not found" });

    if (req.user._id.toString() === req.params.id)
      return res.status(400).json({ message: "Cannot delete own account" });

    // DELETE PERMISSIONS
    if (user.role === "superadmin") {
      return res.status(403).json({ message: "Cannot delete superadmin" });
    }

    if (req.user.role === "admin" && user.role === "admin") {
      return res.status(403).json({ message: "Admin cannot delete another admin" });
    }

    if (req.user.role === "manager") {
      if (user.role !== "executive" || user.assignedManager?.toString() !== req.user._id.toString()) {
        return res.status(403).json({ message: "Can delete only own executives" });
      }
    }

    if (req.user.role === "executive") {
      return res.status(403).json({ message: "Access denied" });
    }

    await User.findByIdAndDelete(req.params.id);

    res.json({ message: "User deleted successfully" });

  } catch (err) {
    next(err);
  }
};
