const router = require('express').Router();
const ctrl = require('../controllers/adminController');
const { requireAuth, requireRole } = require('../middleware/auth');

router.get('/', ctrl.listDepartments);
router.post('/', requireAuth, requireRole('administrator'), ctrl.createDepartment);
router.put('/:id', requireAuth, requireRole('administrator'), ctrl.updateDepartment);
router.delete('/:id', requireAuth, requireRole('administrator'), ctrl.deleteDepartment);

module.exports = router;
