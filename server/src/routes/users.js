const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

/* Administrator only. passwordHash is never serialized (select:false + toJSON transform). */
router.get('/', requireAuth, requireRole('administrator'), ctrl.listUsers);
router.patch('/:id/role', requireAuth, requireRole('administrator'), ctrl.updateRole);
router.patch('/:id', requireAuth, requireRole('administrator'), ctrl.updateUser);

module.exports = router;
