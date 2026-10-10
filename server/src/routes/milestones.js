const router = require('express').Router();
const ctrl = require('../controllers/projectController');
const Milestone = require('../models/Milestone');
const Project = require('../models/Project');
const { requireAuth, requireRole } = require('../middleware/auth');
const { ApiError, asyncHandler } = require('../utils/errors');

const STAFF = ['official', 'administrator'];

/** Officials may only edit milestones of projects in their own department. */
const requireOwnDeptForMilestone = asyncHandler(async (req, _res, next) => {
  if (req.user.role === 'administrator') return next();
  const milestone = await Milestone.findById(req.params.id).select('projectId');
  if (!milestone) return next(ApiError.notFound('Milestone not found.'));
  const project = await Project.findById(milestone.projectId).select('departmentId');
  if (!project) return next(ApiError.notFound('Project not found.'));
  const userDept = req.user.department?._id;
  if (!userDept || String(project.departmentId) !== String(userDept)) {
    return next(ApiError.forbidden('You can only modify milestones of your own department’s projects.'));
  }
  next();
});

router.patch('/:id', requireAuth, requireRole(...STAFF), requireOwnDeptForMilestone, ctrl.updateMilestone);

module.exports = router;
