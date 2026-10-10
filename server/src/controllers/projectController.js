const Project = require('../models/Project');
const Milestone = require('../models/Milestone');
const ProjectUpdate = require('../models/ProjectUpdate');
const AuditLog = require('../models/AuditLog');
const Conflict = require('../models/Conflict');
const { ApiError, asyncHandler } = require('../utils/errors');
const { writeAudit, getEntityTimeline } = require('../services/auditService');
const { reevaluateProject } = require('../services/roadSyncService');

const POPULATE = [
  { path: 'departmentId', select: 'name departmentType' },
  { path: 'assignedOfficerId', select: 'name email' },
];

/** Shape a project for API responses. */
function projectDto(p, extra = {}) {
  return { ...p, department: p.departmentId, assignedOfficer: p.assignedOfficerId, ...extra };
}

/** Compute days overdue in UTC calendar days. */
function daysOverdueOf(p) {
  const effective = p.revisedEndDate || p.plannedEndDate;
  if (!effective) return 0;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const end = new Date(effective);
  const endUtc = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()));
  return Math.max(0, Math.round((todayUtc - endUtc) / (24 * 60 * 60 * 1000)));
}

/**
 * GET /api/projects
 * Public list with search + filters + pagination.
 */
exports.listProjects = asyncHandler(async (req, res) => {
  const { search, status, category, departmentId, roadSegmentId, from, to, overdue, page = 1, limit = 12, sort = '-createdAt' } = req.query;

  const filter = {};
  if (status) filter.status = { $in: String(status).split(',') };
  if (category) filter.category = category;
  if (departmentId) filter.departmentId = departmentId;
  if (roadSegmentId) filter.roadSegmentId = String(roadSegmentId).trim().toUpperCase().replace(/\s+/g, '-');
  if (search) filter.$text = { $search: String(search) };
  if (from || to) {
    filter.startDate = {};
    if (from) filter.startDate.$gte = new Date(from);
    if (to) filter.startDate.$lte = new Date(to);
  }
  // Overdue filter: effective end date has passed, not completed/cancelled.
  if (overdue === '1' || overdue === 'true') {
    const now = new Date();
    filter.plannedEndDate = { $lt: now };
    filter.status = { $nin: ['completed', 'cancelled'] };
    filter.$or = [{ revisedEndDate: null }, { revisedEndDate: { $lt: now } }];
  }

  const pageNum = Math.max(1, parseInt(page, 10) || 1);
  const limitNum = Math.min(50, Math.max(1, parseInt(limit, 10) || 12));

  const [items, total] = await Promise.all([
    Project.find(filter)
      .populate(POPULATE)
      .sort(sort)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean(),
    Project.countDocuments(filter),
  ]);

  res.json({
    items: items.map((p) => projectDto(p, { isOverdue: computeIsOverdue(p) })),
    total,
    page: pageNum,
    pages: Math.ceil(total / limitNum) || 1,
  });
});

function computeIsOverdue(p) {
  if (p.status === 'completed' || p.status === 'cancelled') return false;
  const effective = p.revisedEndDate || p.plannedEndDate;
  if (!effective) return false;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return new Date(effective) < todayUtc;
}

/**
 * GET /api/projects/overdue — must be declared BEFORE /:id
 */
exports.listOverdue = asyncHandler(async (_req, res) => {
  const now = new Date();
  const items = await Project.find({
    plannedEndDate: { $lt: now },
    status: { $nin: ['completed', 'cancelled'] },
    $or: [{ revisedEndDate: null }, { revisedEndDate: { $lt: now } }],
  })
    .populate(POPULATE)
    .sort({ plannedEndDate: 1 })
    .lean();

  const withMeta = await Promise.all(
    items.map(async (p) => {
      const latest = await ProjectUpdate.findOne({ projectId: p._id }).sort({ createdAt: -1 }).lean();
      return projectDto(p, {
        isOverdue: true,
        daysOverdue: daysOverdueOf(p),
        latestUpdate: latest ? { message: latest.message, createdAt: latest.createdAt, updateType: latest.updateType } : null,
      });
    })
  );

  res.json({ items: withMeta, total: withMeta.length });
});

/**
 * GET /api/projects/map — lightweight payload for the map page.
 */
exports.mapProjects = asyncHandler(async (_req, res) => {
  const items = await Project.find({ 'location.point.coordinates': { $exists: true } })
    .populate(POPULATE)
    .lean();
  res.json({
    items: items.map((p) => ({
      _id: p._id,
      title: p.title,
      category: p.category,
      status: p.status,
      isOverdue: computeIsOverdue(p),
      roadSegmentId: p.roadSegmentId,
      startDate: p.startDate,
      plannedEndDate: p.plannedEndDate,
      revisedEndDate: p.revisedEndDate,
      location: p.location,
      department: p.departmentId,
    })),
    total: items.length,
  });
});

/** GET /api/projects/:id */
exports.getProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id).populate(POPULATE).lean();
  if (!project) throw ApiError.notFound('Project not found.');

  const [milestones, updates] = await Promise.all([
    Milestone.find({ projectId: project._id }).sort({ dueDate: 1 }).lean(),
    ProjectUpdate.find({ projectId: project._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .populate('authorId', 'name role')
      .lean(),
  ]);

  res.json({
    project: projectDto(project, {
      isOverdue: computeIsOverdue(project),
      milestones,
      updates: updates.map((u) => ({ ...u, author: u.authorId })),
    }),
  });
});

/** GET /api/projects/:id/history */
exports.getProjectHistory = asyncHandler(async (req, res) => {
  const items = await getEntityTimeline('project', req.params.id, 100);
  res.json({ items, total: items.length });
});

/** GET /api/projects/:id/updates */
exports.getProjectUpdates = asyncHandler(async (req, res) => {
  const updates = await ProjectUpdate.find({ projectId: req.params.id })
    .sort({ createdAt: -1 })
    .populate('authorId', 'name role')
    .lean();
  res.json({ items: updates.map((u) => ({ ...u, author: u.authorId })) });
});

/** Shared validation for create/update. */
function validateProjectInput(body, { partial = false } = {}) {
  const errors = [];
  const out = {};
  if (body.title !== undefined) {
    out.title = String(body.title).trim();
    if (out.title.length < 5 || out.title.length > 160) errors.push({ field: 'title', message: 'Title must be 5–160 characters.' });
  }
  if (body.description !== undefined) {
    out.description = String(body.description).trim();
    if (out.description.length < 20) errors.push({ field: 'description', message: 'Description must be at least 20 characters.' });
  }
  if (body.category !== undefined) out.category = body.category;
  if (body.roadSegmentId !== undefined) {
    out.roadSegmentId = String(body.roadSegmentId).trim();
    if (!out.roadSegmentId) errors.push({ field: 'roadSegmentId', message: 'Road segment ID is required.' });
  }
  if (body.departmentId !== undefined) out.departmentId = body.departmentId;
  if (body.assignedOfficerId !== undefined) out.assignedOfficerId = body.assignedOfficerId || null;
  if (body.contractorName !== undefined) out.contractorName = String(body.contractorName || '').trim();
  if (body.budget !== undefined && body.budget !== '' && body.budget !== null) {
    out.budget = Number(body.budget);
    if (Number.isNaN(out.budget) || out.budget < 0) errors.push({ field: 'budget', message: 'Budget must be a positive number.' });
  }
  if (body.location !== undefined) {
    out.location = {
      address: String(body.location?.address || '').trim(),
      ward: String(body.location?.ward || '').trim(),
    };
    const coords = body.location?.point?.coordinates;
    if (Array.isArray(coords) && coords.length === 2) {
      const [lng, lat] = coords.map(Number);
      if (Number.isFinite(lng) && Number.isFinite(lat) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
        out.location.point = { type: 'Point', coordinates: [lng, lat] };
      } else {
        errors.push({ field: 'location.point', message: 'Coordinates must be valid latitude/longitude numbers.' });
      }
    }
  }
  if (body.startDate !== undefined) out.startDate = new Date(body.startDate);
  if (body.plannedEndDate !== undefined) out.plannedEndDate = new Date(body.plannedEndDate);
  if (body.revisedEndDate !== undefined) out.revisedEndDate = body.revisedEndDate ? new Date(body.revisedEndDate) : null;
  if (body.status !== undefined) out.status = body.status;
  if (body.delayExplanation !== undefined) out.delayExplanation = String(body.delayExplanation || '').trim();

  for (const key of ['startDate', 'plannedEndDate', 'revisedEndDate']) {
    if (out[key] !== undefined && out[key] !== null && Number.isNaN(out[key].getTime())) {
      errors.push({ field: key, message: `${key} is not a valid date.` });
    }
  }
  if (!partial) {
    for (const key of ['title', 'description', 'category', 'roadSegmentId', 'departmentId', 'startDate', 'plannedEndDate']) {
      if (out[key] === undefined) errors.push({ field: key, message: `${key} is required.` });
    }
  }
  if (out.startDate && out.plannedEndDate && out.plannedEndDate < out.startDate) {
    errors.push({ field: 'plannedEndDate', message: 'Planned end date cannot be before the start date.' });
  }
  // Delayed status or a revised date requires a documented explanation.
  if (out.status === 'delayed' && !out.delayExplanation && !partial) {
    errors.push({ field: 'delayExplanation', message: 'An explanation is required when a project is marked delayed.' });
  }
  if (errors.length) throw ApiError.badRequest('Please fix the highlighted fields.', errors);
  return out;
}

/** POST /api/projects */
exports.createProject = asyncHandler(async (req, res) => {
  const data = validateProjectInput(req.body);
  const project = await Project.create({ ...data, createdBy: req.user._id });

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: 'project.created',
    newValues: {
      title: project.title,
      roadSegmentId: project.roadSegmentId,
      status: project.status,
      startDate: project.startDate,
      plannedEndDate: project.plannedEndDate,
    },
    explanation: req.body.explanation || 'Project created.',
  });

  // RoadSync: immediately check the new project against everything else.
  const scan = await reevaluateProject(project._id).catch((err) => {
    console.error('[roadsync] scan after create failed:', err.message);
    return null;
  });

  const populated = await Project.findById(project._id).populate(POPULATE).lean();
  res.status(201).json({ project: projectDto(populated), roadSync: scan });
});

/** PUT /api/projects/:id */
exports.updateProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');

  const data = validateProjectInput(req.body, { partial: true });

  // Schedule edits through the generic update endpoint still require a reason.
  const scheduleTouched =
    (data.startDate && data.startDate.getTime() !== project.startDate.getTime()) ||
    (data.plannedEndDate && data.plannedEndDate.getTime() !== project.plannedEndDate.getTime()) ||
    ('revisedEndDate' in data && String(data.revisedEndDate || '') !== String(project.revisedEndDate || ''));
  if (scheduleTouched && !req.body.reason) {
    throw ApiError.badRequest('A reason is required when changing dates. Use PATCH /projects/:id/schedule or pass "reason".');
  }

  const previous = {
    status: project.status,
    startDate: project.startDate,
    plannedEndDate: project.plannedEndDate,
    revisedEndDate: project.revisedEndDate,
    title: project.title,
  };

  Object.assign(project, data);
  await project.save();

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: scheduleTouched ? 'project.schedule_revised' : 'project.updated',
    previousValues: previous,
    newValues: { status: project.status, startDate: project.startDate, plannedEndDate: project.plannedEndDate, revisedEndDate: project.revisedEndDate, title: project.title },
    explanation: req.body.reason || req.body.explanation || '',
  });

  const scan = await reevaluateProject(project._id).catch((err) => {
    console.error('[roadsync] scan after update failed:', err.message);
    return null;
  });

  const populated = await Project.findById(project._id).populate(POPULATE).lean();
  res.json({ project: projectDto(populated), roadSync: scan });
});

/** PATCH /api/projects/:id/status */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, explanation } = req.body || {};
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');

  if (!['planned', 'active', 'delayed', 'completed', 'cancelled'].includes(status)) {
    throw ApiError.badRequest('Invalid status value.');
  }
  // Accountability rule: delays and cancellations must carry a public reason.
  if (['delayed', 'cancelled'].includes(status) && !explanation) {
    throw ApiError.badRequest('An explanation is required when marking a project delayed or cancelled.');
  }

  const previousStatus = project.status;
  project.status = status;
  if (explanation) project.delayExplanation = String(explanation).trim();
  await project.save();

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: 'project.status_changed',
    previousValues: { status: previousStatus },
    newValues: { status },
    explanation: explanation || '',
  });

  const scan = await reevaluateProject(project._id).catch(() => null);
  const populated = await Project.findById(project._id).populate(POPULATE).lean();
  res.json({ project: projectDto(populated), roadSync: scan });
});

/** PATCH /api/projects/:id/schedule — the accountability-first path. */
exports.reviseSchedule = asyncHandler(async (req, res) => {
  const { startDate, plannedEndDate, revisedEndDate, reason } = req.body || {};
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');
  if (!reason || !String(reason).trim()) {
    throw ApiError.badRequest('A reason is required when revising a schedule.');
  }

  const previous = {
    startDate: project.startDate,
    plannedEndDate: project.plannedEndDate,
    revisedEndDate: project.revisedEndDate,
  };

  if (startDate) {
    const d = new Date(startDate);
    if (Number.isNaN(d.getTime())) throw ApiError.badRequest('startDate is not a valid date.');
    project.startDate = d;
  }
  if (plannedEndDate) {
    const d = new Date(plannedEndDate);
    if (Number.isNaN(d.getTime())) throw ApiError.badRequest('plannedEndDate is not a valid date.');
    project.plannedEndDate = d;
  }
  if (revisedEndDate !== undefined) {
    if (!revisedEndDate) {
      project.revisedEndDate = null;
    } else {
      const d = new Date(revisedEndDate);
      if (Number.isNaN(d.getTime())) throw ApiError.badRequest('revisedEndDate is not a valid date.');
      project.revisedEndDate = d;
    }
  }
  if (project.plannedEndDate < project.startDate) {
    throw ApiError.badRequest('Planned end date cannot be before the start date.');
  }

  await project.save();

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: 'project.schedule_revised',
    previousValues: previous,
    newValues: {
      startDate: project.startDate,
      plannedEndDate: project.plannedEndDate,
      revisedEndDate: project.revisedEndDate,
    },
    explanation: String(reason).trim(),
  });

  // A schedule change may create or clear RoadSync conflicts.
  const scan = await reevaluateProject(project._id).catch(() => null);
  const populated = await Project.findById(project._id).populate(POPULATE).lean();
  res.json({ project: projectDto(populated), roadSync: scan });
});

/** DELETE /api/projects/:id (administrator) */
exports.deleteProject = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');
  await project.deleteOne();

  // Deactivate (never delete) conflicts that reference this project, so no
  // conflict in the database points at a project that no longer exists.
  const linked = await Conflict.find({ projectIds: project._id }).select('_id').lean();
  if (linked.length) {
    await Conflict.updateMany({ projectIds: project._id }, { $set: { isActive: false } });
    for (const c of linked) {
      await writeAudit({
        actor: req.user,
        entityType: 'conflict',
        entityId: c._id,
        action: 'conflict.deactivated',
        newValues: { isActive: false },
        explanation: `Project "${project.title}" was deleted; its conflicts are closed but kept for history.`,
      });
    }
  }

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: 'project.deleted',
    previousValues: { title: project.title, status: project.status },
    explanation: req.body?.reason || 'Deleted by administrator.',
  });
  res.json({ message: 'Project deleted.' });
});

/** POST /api/projects/:id/milestones */
exports.addMilestone = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');
  const { title, description, dueDate } = req.body || {};
  if (!title || !dueDate) throw ApiError.badRequest('title and dueDate are required.');

  const milestone = await Milestone.create({
    projectId: project._id,
    title: String(title).trim(),
    description: String(description || '').trim(),
    dueDate: new Date(dueDate),
  });

  await writeAudit({
    actor: req.user,
    entityType: 'milestone',
    entityId: milestone._id,
    action: 'milestone.created',
    newValues: { title: milestone.title, dueDate: milestone.dueDate },
    explanation: `Milestone added to project “${project.title}”.`,
  });

  res.status(201).json({ milestone });
});

/** PATCH /api/milestones/:id */
exports.updateMilestone = asyncHandler(async (req, res) => {
  const milestone = await Milestone.findById(req.params.id).populate({ path: 'projectId', select: 'departmentId title' });
  if (!milestone) throw ApiError.notFound('Milestone not found.');

  const { status, evidence, verified } = req.body || {};
  const previousStatus = milestone.status;

  if (status) {
    if (!['pending', 'in_progress', 'completed', 'skipped'].includes(status)) {
      throw ApiError.badRequest('Invalid milestone status.');
    }
    // Completing a milestone requires a caption describing the evidence.
    if (status === 'completed' && !milestone.evidence?.caption && !evidence?.caption) {
      throw ApiError.badRequest('Completing a milestone requires an evidence caption describing what was done.');
    }
    milestone.status = status;
    milestone.completedAt = status === 'completed' ? new Date() : null;
  }
  if (evidence?.caption) {
    milestone.evidence = {
      url: evidence.url || '',
      caption: String(evidence.caption).trim(),
      verified: false, // uploading evidence never implies verification
    };
  }
  // Only an administrator can mark evidence as independently verified.
  if (verified === true) {
    if (req.user.role !== 'administrator') throw ApiError.forbidden('Only administrators can mark evidence as verified.');
    milestone.evidence = { ...(milestone.evidence?.toObject?.() || milestone.evidence), verified: true, verifiedBy: req.user._id, verifiedAt: new Date() };
  }

  await milestone.save();
  await writeAudit({
    actor: req.user,
    entityType: 'milestone',
    entityId: milestone._id,
    action: 'milestone.updated',
    previousValues: { status: previousStatus },
    newValues: { status: milestone.status, verified: milestone.evidence?.verified || false },
  });

  res.json({ milestone });
});

/** POST /api/projects/:id/updates */
exports.addUpdate = asyncHandler(async (req, res) => {
  const project = await Project.findById(req.params.id);
  if (!project) throw ApiError.notFound('Project not found.');
  const { updateType, message, evidence } = req.body || {};
  if (!message || String(message).trim().length < 5) throw ApiError.badRequest('A message of at least 5 characters is required.');

  const update = await ProjectUpdate.create({
    projectId: project._id,
    authorId: req.user._id,
    updateType: updateType || 'general',
    message: String(message).trim(),
    evidence: Array.isArray(evidence) ? evidence.map((e) => ({ url: e.url || '', caption: e.caption || '', verified: false })) : [],
  });

  await writeAudit({
    actor: req.user,
    entityType: 'project',
    entityId: project._id,
    action: 'project.update_published',
    newValues: { updateType: update.updateType },
    explanation: update.message.slice(0, 200),
  });

  res.status(201).json({ update });
});
