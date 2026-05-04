const express = require('express');
const router = express.Router();
const leadCtrl = require('../controllers/leadController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

// ============================================================
// ✅ ALL STATIC ROUTES MUST COME BEFORE /:id
// ============================================================

// Stats
router.get(
  '/stats/dashboard',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getLeadStats
);

// Bulk import
router.post(
  '/bulk-import',
  protect,
  authorizeRoles('admin', 'superadmin'),
  leadCtrl.bulkImportLeads
);

// Follow-up static routes
router.get(
  '/followups/today',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getTodaysFollowUps
);

router.get(
  '/followups/upcoming',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getUpcomingFollowUps
);

router.get(
  '/followups/range',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getFollowUpsByDateRange
);

// Manager specific static routes
router.get(
  '/manager/executives',
  protect,
  authorizeRoles('manager'),
  leadCtrl.getManagerExecutives
);

router.get(
  '/manager/unassigned',
  protect,
  authorizeRoles('manager'),
  leadCtrl.getUnassignedLeads
);

router.get(
  '/manager/team-performance',
  protect,
  authorizeRoles('manager'),
  leadCtrl.getTeamPerformance
);

router.get(
  '/manager/recent-activities',
  protect,
  authorizeRoles('manager'),
  leadCtrl.getRecentActivities
);

// Edit route (PUT) - also static segment, must be before /:id
router.put(
  '/edit/:id',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.updateLead
);

// ============================================================
// ✅ DYNAMIC ROUTES (:id) COME AFTER ALL STATIC ROUTES
// ============================================================

router.post(
  '/',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager'),
  leadCtrl.createLead
);

router.get(
  '/',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getLeads
);

router.get(
  '/:id',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getLead
);

router.put(
  '/:id/status',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.updateStatus
);

router.delete(
  '/:id',
  protect,
  authorizeRoles('admin', 'superadmin'),
  leadCtrl.deleteLead
);

router.get(
  '/:id/timeline',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.getLeadTimeline
);

router.patch(
  '/:leadId/followups/:followUpId/complete',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.completeFollowUp
);

router.put(
  '/:leadId/assign-manager',
  protect,
  authorizeRoles('admin', 'superadmin'),
  leadCtrl.assignToManager
);

router.put(
  '/:leadId/assign-exec',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager'),
  leadCtrl.assignToExecutive
);

router.post('/:id/follow-ups', protect, leadCtrl.addFollowUp);

router.post(
  '/:id/remarks',
  protect,
  authorizeRoles('admin', 'superadmin', 'manager', 'executive'),
  leadCtrl.addRemark
);

module.exports = router;