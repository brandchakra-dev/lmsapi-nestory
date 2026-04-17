const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/attendanceController");

router.post("/punch-in", protect, ctrl.punchIn);
router.post("/punch-out", protect, ctrl.punchOut);
router.get("/my", protect, ctrl.myAttendance);
router.get("/team", protect, ctrl.teamAttendance);
router.get("/all", protect, ctrl.allAttendance);

router.get("/export", protect, authorizeRoles("admin","superadmin"), ctrl.exportAttendanceExcel);
router.delete("/:id", protect, authorizeRoles("admin","superadmin"), ctrl.deleteAttendance);

module.exports = router;
