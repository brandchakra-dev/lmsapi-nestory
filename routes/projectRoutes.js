const express = require("express");
const router = express.Router();
const upload = require("../middleware/upload");
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const ctrl = require("../controllers/projectController");

router.post(
  "/",
  protect,
  authorizeRoles("superadmin", "admin"),
  upload.single("brochure"),
  ctrl.createProject
);

router.put(
  "/:id",
  protect,
  authorizeRoles("superadmin", "admin"),
  upload.single("brochure"),
  ctrl.updateProject
);

router.delete(
  "/:id",
  protect,
  authorizeRoles("superadmin"),
  ctrl.deleteProject
);

router.patch(
  "/:id/status",
  protect,
  authorizeRoles("superadmin", "admin"),
  ctrl.toggleStatus
);

router.post(
  "/:id/assign",
  protect,
  authorizeRoles("superadmin", "admin"),
  ctrl.assignProject
);

router.get("/", protect, ctrl.getProjects);
router.get("/:id", protect, ctrl.getProjectById);

module.exports = router;
