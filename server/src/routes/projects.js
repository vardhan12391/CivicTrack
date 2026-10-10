const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const Project = require('../models/Project');
const { requireAuth, requireRole, requireOwnDepartment } = require('../middleware/auth');
const { ApiError } = require('../utils/errors');

const STAFF = ['official', 'administrator'];

/* ---------- Public reads (special paths before /:id) ---------- */
router.get('/', ctrl.listProjects);
router.get('/overdue', ctrl.listOverdue);
router.get('/map', ctrl.mapProjects);
router.get('/:id', ctrl.getProject);
router.get('/:id/history', ctrl.getProjectHistory);
router.get('/:id/updates', ctrl.getProjectUpdates);

/**
 * Officials may only create projects inside their own department;
 * administrators may create projects for any department.
 */
function requireOwnDeptOnCreate(req, _res, next) {
  if (req.user.role === 'administrator') return next();
  const userDept = req.user.department?._id;
  if (!userDept) return next(ApiError.forbidden('Your account is not assigned to a department.'));
  if (!req.body?.departmentId || String(req.body.departmentId) !== String(userDept)) {
    return next(ApiError.forbidden('Officials can only create projects for their own department.'));
  }
  next();
}

/* ---------- Mutations ---------- */
router.post('/', requireAuth, requireRole(...STAFF), requireOwnDeptOnCreate, ctrl.createProject);
router.put('/:id', requireAuth, requireRole(...STAFF), requireOwnDepartment(Project), ctrl.updateProject);
router.patch('/:id/status', requireAuth, requireRole(...STAFF), requireOwnDepartment(Project), ctrl.updateStatus);
router.patch('/:id/schedule', requireAuth, requireRole(...STAFF), requireOwnDepartment(Project), ctrl.reviseSchedule);
router.delete('/:id', requireAuth, requireRole('administrator'), ctrl.deleteProject);

router.post('/:id/milestones', requireAuth, requireRole(...STAFF), requireOwnDepartment(Project), ctrl.addMilestone);
router.post('/:id/updates', requireAuth, requireRole(...STAFF), requireOwnDepartment(Project), ctrl.addUpdate);

module.exports = router;
