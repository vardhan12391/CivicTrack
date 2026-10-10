const router = require('express').Router();
const adminCtrl = require('../controllers/adminController');
const { getEntityTimeline } = require('../services/auditService');
const { requireAuth, requireRole } = require('../middleware/auth');
const { asyncHandler } = require('../utils/errors');

/* Global audit log: administrator only. */
router.get('/', requireAuth, requireRole('administrator'), adminCtrl.listAudit);

/* Per-entity timeline: officials see their entity's history too. */
router.get(
  '/:entityType/:entityId',
  requireAuth,
  requireRole('official', 'administrator'),
  asyncHandler(async (req, res) => {
    const items = await getEntityTimeline(req.params.entityType, req.params.entityId, 100);
    res.json({ items, total: items.length });
  })
);

module.exports = router;
