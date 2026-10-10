const Project = require('../models/Project');
const CitizenReport = require('../models/CitizenReport');
const Conflict = require('../models/Conflict');
const Department = require('../models/Department');
const { asyncHandler } = require('../utils/errors');

/** Shared "is overdue" predicate expressed as aggregation-friendly values. */
function overdueCriteria() {
  const now = new Date();
  return {
    plannedEndDate: { $lt: now },
    status: { $nin: ['completed', 'cancelled'] },
    $or: [{ revisedEndDate: null }, { revisedEndDate: { $lt: now } }],
  };
}

/**
 * GET /api/analytics/summary
 * Totals used by the dashboards. Everything here is computed from the
 * database — nothing is hard-coded.
 */
exports.summary = asyncHandler(async (_req, res) => {
  const [total, byStatus, overdue, budgetAgg, reportsOpen, reportsResolved, conflictsOpen, conflictsResolved, conflictsDismissed, conflictsUnderReview, departments] =
    await Promise.all([
      Project.countDocuments({}),
      Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
      Project.countDocuments(overdueCriteria()),
      Project.aggregate([
        { $match: { status: { $nin: ['cancelled'] } } },
        { $group: { _id: null, total: { $sum: '$budget' } } },
      ]),
      CitizenReport.countDocuments({ status: { $nin: ['resolved', 'rejected'] } }),
      CitizenReport.countDocuments({ status: 'resolved' }),
      Conflict.countDocuments({ status: { $in: ['unreviewed', 'under_review'] } }),
      Conflict.countDocuments({ status: 'resolved' }),
      Conflict.countDocuments({ status: 'dismissed' }),
      Conflict.countDocuments({ status: 'under_review' }),
      Department.countDocuments({}),
    ]);

  const statusMap = Object.fromEntries(byStatus.map((s) => [s._id, s.count]));

  res.json({
    totals: {
      projects: {
        total,
        planned: statusMap.planned || 0,
        active: statusMap.active || 0,
        delayed: statusMap.delayed || 0,
        completed: statusMap.completed || 0,
        cancelled: statusMap.cancelled || 0,
        overdue,
        totalBudget: budgetAgg[0]?.total || 0,
      },
      reports: {
        open: reportsOpen,
        resolved: reportsResolved,
      },
      conflicts: {
        open: conflictsOpen,
        unreviewed: conflictsOpen - conflictsUnderReview,
        underReview: conflictsUnderReview,
        resolved: conflictsResolved,
        dismissed: conflictsDismissed,
      },
      departments,
    },
  });
});

/** GET /api/analytics/charts — distributions for Chart.js. */
exports.charts = asyncHandler(async (_req, res) => {
  const [statusDist, deptWorkload, completionTrend, delayedByDept, reportCategories, conflictStatus] =
    await Promise.all([
      Project.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]),
      Project.aggregate([
        { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        {
          $facet: {
            total: [{ $group: { _id: '$dept.name', count: { $sum: 1 } } }, { $sort: { count: -1 } }],
            active: [{ $match: { status: { $in: ['active', 'delayed'] } } }, { $group: { _id: '$dept.name', count: { $sum: 1 } } }],
          },
        },
      ]),
      Project.aggregate([
        { $match: { status: 'completed', completedAt: { $ne: null } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$updatedAt' } }, count: { $sum: 1 } } },
        { $sort: { _id: 1 } },
        { $limit: 12 },
      ]),
      Project.aggregate([
        { $match: overdueCriteria() },
        { $lookup: { from: 'departments', localField: 'departmentId', foreignField: '_id', as: 'dept' } },
        { $unwind: { path: '$dept', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$dept.name', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      CitizenReport.aggregate([{ $group: { _id: '$category', count: { $sum: 1 } } }, { $sort: { count: -1 } }]),
      Conflict.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    ]);

  const workload = deptWorkload[0] || { total: [], active: [] };
  const activeMap = Object.fromEntries(workload.active.map((d) => [d._id, d.count]));

  res.json({
    statusDistribution: statusDist.map((s) => ({ label: s._id, value: s.count })),
    departmentWorkload: workload.total.map((d) => ({ label: d._id || 'Unassigned', value: d.count, active: activeMap[d._id] || 0 })),
    completionTrend: completionTrend.map((m) => ({ label: m._id, value: m.count })),
    delayedByDepartment: delayedByDept.map((d) => ({ label: d._id || 'Unassigned', value: d.count })),
    reportCategories: reportCategories.map((c) => ({ label: c._id, value: c.count })),
    conflictStatus: conflictStatus.map((c) => ({ label: c._id, value: c.count })),
  });
});

/**
 * GET /api/analytics/impact
 * Activity counters only — deliberately NOT financial claims. Any estimate
 * would need verified evidence we do not have.
 */
exports.impact = asyncHandler(async (_req, res) => {
  const [detected, reviewed, resolved, schedulesRevised, reportsResolved] = await Promise.all([
    Conflict.countDocuments({}),
    Conflict.countDocuments({ reviewedBy: { $ne: null } }),
    Conflict.countDocuments({ status: { $in: ['resolved', 'dismissed'] } }),
    // Schedule revisions recorded in the audit log after conflict work began.
    require('../models/AuditLog').countDocuments({ action: 'project.schedule_revised' }),
    CitizenReport.countDocuments({ status: 'resolved' }),
  ]);

  res.json({
    impact: {
      conflictsDetected: detected,
      conflictsReviewed: reviewed,
      conflictsClosed: resolved,
      schedulesRevised,
      reportsResolved,
    },
    disclaimer:
      'These are activity counts recorded by CivicTrack, not verified financial or time savings. '
      + 'Any monetary estimate would require independent verification of the underlying work.',
  });
});
