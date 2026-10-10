const Conflict = require('../models/Conflict');
const Project = require('../models/Project');
const { ApiError, asyncHandler } = require('../utils/errors');
const { writeAudit, getEntityTimeline } = require('../services/auditService');
const { detectConflicts, reevaluateProject } = require('../services/roadSyncService');

/**
 * GET /api/conflicts
 * Public read (the public should see potential conflicts for transparency);
 * mutations are official-only.
 */
exports.listConflicts = asyncHandler(async (req, res) => {
  const { status, priority, roadSegmentId, departmentId } = req.query;
  const filter = {};
  if (status) filter.status = { $in: String(status).split(',') };
  if (priority) filter.priority = priority;
  if (roadSegmentId) filter.roadSegmentId = String(roadSegmentId).trim().toUpperCase().replace(/\s+/g, '-');
  if (departmentId) filter.departmentIds = departmentId;

  const items = await Conflict.find(filter)
    .populate({
      path: 'projectIds',
      // location is included so the public map can plot conflict markers.
      select: 'title roadSegmentId status startDate plannedEndDate revisedEndDate departmentId location',
      populate: { path: 'departmentId', select: 'name departmentType' },
    })
    .populate('reviewedBy', 'name')
    .populate('resolvedBy', 'name')
    .populate({ path: 'reviewNotes.by', select: 'name' })
    .sort({ isActive: -1, createdAt: -1 })
    .lean();

  const summary = {
    total: await Conflict.countDocuments({}),
    unreviewed: await Conflict.countDocuments({ status: 'unreviewed' }),
    under_review: await Conflict.countDocuments({ status: 'under_review' }),
    resolved: await Conflict.countDocuments({ status: 'resolved' }),
    dismissed: await Conflict.countDocuments({ status: 'dismissed' }),
    active: await Conflict.countDocuments({ isActive: true }),
  };

  res.json({ items, summary });
});

/** GET /api/conflicts/:id — with both projects + history. */
exports.getConflict = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id)
    .populate({ path: 'projectIds', populate: [{ path: 'departmentId', select: 'name departmentType' }, { path: 'assignedOfficerId', select: 'name' }] })
    .populate('reviewedBy', 'name')
    .populate('resolvedBy', 'name')
    .populate({ path: 'reviewNotes.by', select: 'name' })
    .lean();
  if (!conflict) throw ApiError.notFound('Conflict not found.');

  const history = await getEntityTimeline('conflict', conflict._id, 50);
  res.json({ conflict, history });
});

/** POST /api/conflicts/scan — manual re-run by an official. */
exports.scan = asyncHandler(async (_req, res) => {
  const result = await detectConflicts();
  res.json({ message: 'Detection scan complete.', ...result });
});

/**
 * PATCH /api/conflicts/:id/status
 * under_review (needs reviewNote) | resolved (needs resolution) | dismissed (needs resolution)
 */
exports.updateStatus = asyncHandler(async (req, res) => {
  const { status, reviewNote, resolution } = req.body || {};
  const allowed = ['under_review', 'resolved', 'dismissed'];
  if (!allowed.includes(status)) throw ApiError.badRequest(`status must be one of: ${allowed.join(', ')}.`);

  const note = String(status === 'under_review' ? reviewNote || '' : resolution || '').trim();
  if (!note) {
    throw ApiError.badRequest(
      status === 'under_review'
        ? 'A review note is required.'
        : 'A documented resolution/explanation is required.'
    );
  }

  const conflict = await Conflict.findById(req.params.id);
  if (!conflict) throw ApiError.notFound('Conflict not found.');
  if (['resolved', 'dismissed'].includes(conflict.status)) {
    throw ApiError.conflict('This conflict has already been closed. Its history is preserved.');
  }

  const previousStatus = conflict.status;
  conflict.status = status;
  conflict.reviewNotes = [...(conflict.reviewNotes || []), { status, note, by: req.user._id, at: new Date() }];
  conflict.reviewedBy = req.user._id;
  conflict.reviewNote = note;

  if (status === 'resolved' || status === 'dismissed') {
    conflict.resolution = note;
    conflict.resolvedBy = req.user._id;
    conflict.resolvedAt = new Date();
    conflict.isActive = false; // closed for the dashboard, kept for history
  }

  await conflict.save();

  await writeAudit({
    actor: req.user,
    entityType: 'conflict',
    entityId: conflict._id,
    action: `conflict.${status}`,
    previousValues: { status: previousStatus },
    newValues: { status, roadSegmentId: conflict.roadSegmentId },
    explanation: note,
  });

  res.json({ conflict });
});

/** POST /api/conflicts/:id/rescan — re-check one conflict against live data. */
exports.rescan = asyncHandler(async (req, res) => {
  const conflict = await Conflict.findById(req.params.id);
  if (!conflict) throw ApiError.notFound('Conflict not found.');
  const projectId = conflict.projectIds[0];
  const result = await reevaluateProject(projectId);
  const updated = await Conflict.findById(conflict._id).lean();
  res.json({ conflict: updated, roadSync: result });
});
