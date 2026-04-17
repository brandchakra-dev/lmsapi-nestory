const express = require('express');
const router = express.Router();
const earningCtrl = require('../controllers/earningController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

router.get('/', protect, earningCtrl.getEarnings);
router.put('/:id/approve', protect, authorizeRoles('admin','superadmin','manager'), earningCtrl.approveEarning);

module.exports = router;
