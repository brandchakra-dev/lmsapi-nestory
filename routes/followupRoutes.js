const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/followupController");

router.get("/follow", protect, authorizeRoles("manager", "executive"), ctrl.getMyFollowups
);

module.exports = router;
