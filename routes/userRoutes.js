const express = require("express");
const router = express.Router();
const { protect, authorizeRoles } = require("../middleware/authMiddleware");
const userController = require("../controllers/userController");

// CREATE
router.post(
  "/",
  protect,
  authorizeRoles("superadmin", "admin", "manager"),
  userController.create
);

// GET ALL
router.get(
  "/",
  protect,
  authorizeRoles("superadmin", "admin", "manager"),
  userController.getAll
);

// GET SINGLE
router.get(
  "/:id",
  protect,
  authorizeRoles("superadmin", "admin", "manager"),
  userController.getById
);

// UPDATE
router.put(
  "/:id",
  protect,
  authorizeRoles("superadmin", "admin", "manager"),
  userController.update
);

// DELETE
router.delete(
  "/:id",
  protect,
  authorizeRoles("superadmin", "admin", "manager"),
  userController.remove
);

router.post("/save-push-token", protect, userController.savePushToken);

module.exports = router;
