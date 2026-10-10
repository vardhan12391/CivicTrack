const User = require('../models/User');
const Department = require('../models/Department');
const AuditLog = require('../models/AuditLog');
const Project = require('../models/Project');
const { ApiError, asyncHandler } = require('../utils/errors');
const { writeAudit } = require('../services/auditService');

/** ---------- Users (administrator) ---------- */

exports.listUsers = asyncHandler(async (req, res) => {
  const { role, page = 1, limit = 50 } = req.query;
  const filter = {};
  if (role) filter.role = role;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 50));

  const [items, total] = await Promise.all([
    User.find(filter)
      .populate('departmentId', 'name departmentType')
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    User.countDocuments(filter),
  ]);

  res.json({
    items: items.map((u) => ({ ...u, department: u.departmentId })),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
});

/** PATCH /api/users/:id/role — administrator only, audited. */
exports.updateRole = asyncHandler(async (req, res) => {
  const { role } = req.body || {};
  if (!['citizen', 'official', 'administrator'].includes(role)) throw ApiError.badRequest('Invalid role.');

  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  // Demoting the last administrator would lock everyone out of admin actions.
  if (user.role === 'administrator' && role !== 'administrator') {
    const remaining = await User.countDocuments({ role: 'administrator', _id: { $ne: user._id }, isActive: true });
    if (remaining === 0) throw ApiError.badRequest('Cannot demote the last active administrator.');
  }

  // Officials must belong to a department.
  if (role === 'official' && !user.departmentId) {
    throw ApiError.badRequest('Assign this user to a department before making them an official. Use the department field on the user.');
  }

  const previousRole = user.role;
  user.role = role;
  await user.save();

  await writeAudit({
    actor: req.user,
    entityType: 'user',
    entityId: user._id,
    action: 'user.role_changed',
    previousValues: { role: previousRole },
    newValues: { role },
    explanation: req.body?.reason || 'Role changed by administrator.',
  });

  res.json({ user });
});

/** PATCH /api/users/:id — activate/deactivate, set department. */
exports.updateUser = asyncHandler(async (req, res) => {
  const user = await User.findById(req.params.id);
  if (!user) throw ApiError.notFound('User not found.');

  const previous = { isActive: user.isActive, departmentId: user.departmentId };
  if (typeof req.body?.isActive === 'boolean') {
    if (String(user._id) === String(req.user._id) && req.body.isActive === false) {
      throw ApiError.badRequest('You cannot deactivate your own account.');
    }
    user.isActive = req.body.isActive;
  }
  if (req.body?.departmentId !== undefined) {
    if (req.body.departmentId) {
      const dept = await Department.findById(req.body.departmentId).select('_id');
      if (!dept) throw ApiError.badRequest('That department does not exist.');
      user.departmentId = dept._id;
    } else {
      user.departmentId = null;
    }
  }
  await user.save();

  await writeAudit({
    actor: req.user,
    entityType: 'user',
    entityId: user._id,
    action: 'user.updated',
    previousValues: previous,
    newValues: { isActive: user.isActive, departmentId: user.departmentId },
  });

  res.json({ user });
});

/** ---------- Audit (administrator read; officials read per-entity) ---------- */

exports.listAudit = asyncHandler(async (req, res) => {
  const { entityType, actorId, action, page = 1, limit = 25 } = req.query;
  const filter = {};
  if (entityType) filter.entityType = entityType;
  if (actorId) filter.actorId = actorId;
  if (action) filter.action = new RegExp(String(action).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(100, Math.max(1, parseInt(limit, 10) || 25));

  const [items, total] = await Promise.all([
    AuditLog.find(filter)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .populate('actorId', 'name email role')
      .lean(),
    AuditLog.countDocuments(filter),
  ]);

  res.json({
    items: items.map((e) => ({ ...e, actor: e.actorId })),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
});

/** ---------- Departments ---------- */

exports.listDepartments = asyncHandler(async (_req, res) => {
  const items = await Department.find({}).sort({ name: 1 }).lean();
  res.json({ items, total: items.length });
});

exports.createDepartment = asyncHandler(async (req, res) => {
  const { name, departmentType, description, contactEmail } = req.body || {};
  if (!name || !departmentType) throw ApiError.badRequest('name and departmentType are required.');
  const dept = await Department.create({
    name: String(name).trim(),
    departmentType,
    description: String(description || '').trim(),
    contactEmail: String(contactEmail || '').trim(),
  });
  await writeAudit({
    actor: req.user,
    entityType: 'department',
    entityId: dept._id,
    action: 'department.created',
    newValues: { name: dept.name, departmentType: dept.departmentType },
  });
  res.status(201).json({ department: dept });
});

exports.updateDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound('Department not found.');
  const previous = { name: dept.name, departmentType: dept.departmentType };
  if (req.body.name) dept.name = String(req.body.name).trim();
  if (req.body.departmentType) dept.departmentType = req.body.departmentType;
  if (req.body.description !== undefined) dept.description = String(req.body.description || '').trim();
  if (req.body.contactEmail !== undefined) dept.contactEmail = String(req.body.contactEmail || '').trim();
  await dept.save();
  await writeAudit({
    actor: req.user,
    entityType: 'department',
    entityId: dept._id,
    action: 'department.updated',
    previousValues: previous,
    newValues: { name: dept.name, departmentType: dept.departmentType },
  });
  res.json({ department: dept });
});

exports.deleteDepartment = asyncHandler(async (req, res) => {
  const dept = await Department.findById(req.params.id);
  if (!dept) throw ApiError.notFound('Department not found.');
  const projects = await Project.countDocuments({ departmentId: dept._id });
  if (projects > 0) throw ApiError.conflict(`Cannot delete: ${projects} project(s) still reference this department.`);
  await dept.deleteOne();
  await writeAudit({
    actor: req.user,
    entityType: 'department',
    entityId: dept._id,
    action: 'department.deleted',
    previousValues: { name: dept.name },
  });
  res.json({ message: 'Department deleted.' });
});
