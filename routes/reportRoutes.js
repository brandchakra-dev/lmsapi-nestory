const express = require('express');
const router = express.Router();
const { protect, authorizeRoles } = require('../middleware/authMiddleware');
const ctrl = require("../controllers/reportController");

router.get(
  "/summary", protect,  authorizeRoles("superadmin","admin"),
  ctrl.superAdminSummary
);

router.get('/chart-data',protect, authorizeRoles("superadmin","admin"), ctrl.chartData);

router.get(
  "/manager-summary",
  protect,
  authorizeRoles("manager"),
  ctrl.managerSummary
);

router.get('/manager-chart-data', protect, authorizeRoles('manager'), ctrl.managerChartData);

router.get(
  "/executive-summary",
  protect,
  authorizeRoles("executive"),
  ctrl.executiveSummary
);

router.get('/executive-chart-data', protect, authorizeRoles('executive'), ctrl.executiveChartData);

router.get( "/activity",protect, authorizeRoles("superadmin","admin"), ctrl.getAllActivity);


module.exports = router;
