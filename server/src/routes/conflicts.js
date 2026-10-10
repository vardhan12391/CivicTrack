const router = require('express').Router();
const ctrl = require('../controllers/conflictController');
const { requireAuth, requireRole } = require('../middleware/auth');

const STAFF = ['official', 'administrator'];

/* Public reads — the public can see potential conflicts for transparency. */
router.get('/', ctrl.listConflicts);
router.get('/:id', ctrl.getConflict);

/* Official-only actions */
router.post('/scan', requireAuth, requireRole(...STAFF), ctrl.scan);
router.post('/:id/rescan', requireAuth, requireRole(...STAFF), ctrl.rescan);
router.patch('/:id/status', requireAuth, requireRole(...STAFF), ctrl.updateStatus);

module.exports = router;
