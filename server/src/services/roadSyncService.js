/**
 * ============================================================
 *  RoadSync — deterministic conflict-detection engine
 * ============================================================
 *
 *  Question it answers:
 *  "Are two projects from DIFFERENT departments scheduled on the SAME road
 *   segment with OVERLAPPING date ranges?"
 *
 *  Rules (all must hold for a conflict to be raised):
 *   1. Compare only projects with different IDs               (no self-pairs)
 *   2. Compare only projects from different departments       (same-dept work
 *      is that department's own scheduling problem, not a coordination conflict)
 *   3. Normalise road segment IDs before comparing            ("main road 01"
 *      === "MAIN-ROAD-01")
 *   4. Inclusive date overlap: startA <= endB && startB <= endA
 *   5. Only planned/active/delayed projects are "scheduled work"
 *      (completed & cancelled projects are in the past)
 *   6. Unrelated segments never conflict
 *
 *  Output: a Conflict document per (project pair, segment) with a written
 *  explanation. Conflicts are POTENTIAL conflicts for human review — RoadSync
 *  never reschedules anything itself.
 *
 *  Re-evaluation: whenever a project is created or its schedule changes,
 *  `reevaluateProject()` re-checks that project against all others and
 *  resolves/reopens conflicts whose overlap no longer (or again) holds.
 *  Historical conflicts are marked inactive, never deleted, so the resolution
 *  history survives.
 * ============================================================
 */

const Conflict = require('../models/Conflict');
const Project = require('../models/Project');
const { writeAudit } = require('./auditService');

/** Statuses that count as currently-scheduled work. */
const SCHEDULABLE_STATUSES = ['planned', 'active', 'delayed'];

/**
 * Inclusive overlap test on day-precision UTC dates.
 * Returns the overlap window { start, end } or null.
 *  startA <= endB && startB <= endA   (inclusive: touching endpoints overlap)
 */
function overlapWindow(aStart, aEnd, bStart, bEnd) {
  if (!aStart || !aEnd || !bStart || !bEnd) return null;
  const start = aStart > bStart ? aStart : bStart;
  const end = aEnd < bEnd ? aEnd : bEnd;
  if (start <= end) return { start, end };
  return null;
}

/** Whole days in an inclusive window (same day = 1 day). */
function overlapDays(start, end) {
  const ms = end - start;
  return Math.round(ms / (24 * 60 * 60 * 1000)) + 1;
}

/** Priority: long overlaps are more disruptive. */
function priorityFor(days) {
  if (days >= 7) return 'high';
  if (days >= 3) return 'medium';
  return 'low';
}

/** Normalise a date value to a UTC-midnight Date (day precision). */
function toUtcDay(value) {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * Build the human-readable explanation for a detected pair.
 */
function buildExplanation({ pA, pB, segment, window, days }) {
  const fmt = (d) => d.toISOString().slice(0, 10);
  return (
    `${pA.department?.name || 'One department'} is working on road segment ${segment} ` +
    `from ${fmt(toUtcDay(pA.startDate))} to ${fmt(toUtcDay(pA.revisedEndDate || pA.plannedEndDate))}, ` +
    `while ${pB.department?.name || 'another department'} has scheduled ${pB.title} ` +
    `(${pB.category.replace(/_/g, ' ')}) on the same segment from ${fmt(toUtcDay(pB.startDate))} ` +
    `to ${fmt(toUtcDay(pB.revisedEndDate || pB.plannedEndDate))}. ` +
    `The schedules overlap for ${days} day${days === 1 ? '' : 's'} ` +
    `(${fmt(window.start)} – ${fmt(window.end)}). ` +
    `Both departments may open the same road twice unless the schedules are coordinated.`
  );
}

/**
 * Core pure comparison: given two hydrated project-like objects, return a
 * conflict descriptor or null. Exported for unit tests (no database needed).
 *
 * @param {object} pA { _id, roadSegmentId, departmentId, status, startDate, plannedEndDate, revisedEndDate, title, category, department }
 */
function compareProjects(pA, pB) {
  // Rule 1: different projects
  if (String(pA._id) === String(pB._id)) return null;

  // Rule 2: different departments
  const deptA = pA.departmentId?._id || pA.departmentId;
  const deptB = pB.departmentId?._id || pB.departmentId;
  if (!deptA || !deptB || String(deptA) === String(deptB)) return null;

  // Rule 3: same normalised road segment (both store the normalised form)
  const segA = (pA.roadSegmentId || '').toString().trim().toUpperCase();
  const segB = (pB.roadSegmentId || '').toString().trim().toUpperCase();
  if (!segA || !segB || segA !== segB) return null;

  // Rule 5: both must be currently-scheduled work
  if (!SCHEDULABLE_STATUSES.includes(pA.status) || !SCHEDULABLE_STATUSES.includes(pB.status)) {
    return null;
  }

  // Rule 4: inclusive overlap of effective windows
  const window = overlapWindow(
    toUtcDay(pA.startDate), toUtcDay(pA.revisedEndDate || pA.plannedEndDate),
    toUtcDay(pB.startDate), toUtcDay(pB.revisedEndDate || pB.plannedEndDate)
  );
  if (!window) return null;

  const days = overlapDays(window.start, window.end);

  // Canonical project ordering keeps pair keys stable.
  const [first, second] = String(pA._id) < String(pB._id) ? [pA, pB] : [pB, pA];

  return {
    projectIds: [first._id, second._id],
    conflictType: 'schedule_overlap',
    roadSegmentId: segA,
    departmentIds: [deptA, deptB],
    overlapStartDate: window.start,
    overlapEndDate: window.end,
    priority: priorityFor(days),
    overlapDays: days,
    explanation: buildExplanation({ pA: first, pB: second, segment: segA, window, days }),
  };
}

/**
 * Run detection across the whole database (or a subset) and persist results.
 *
 * @param {object} [options]
 * @param {string[]} [options.onlyProjectIds] limit the scan to these projects (still compares against all others)
 * @param {object} [options.session] mongoose session
 * @returns {{ created: number, reactivated: number, cleared: number, active: number, candidates: number }}
 */
async function detectConflicts(options = {}) {
  const { onlyProjectIds = null } = options;

  // Load every project that could be part of a conflict, with departments.
  const filter = { status: { $in: SCHEDULABLE_STATUSES } };
  if (onlyProjectIds && onlyProjectIds.length) {
    filter.$or = [{ _id: { $in: onlyProjectIds } }];
  }
  const projects = await Project.find(filter)
    .populate('departmentId', 'name departmentType')
    .lean();

  // For "only" scans we also need ALL schedulable projects to pair against.
  const allProjects =
    onlyProjectIds && onlyProjectIds.length
      ? await Project.find({ status: { $in: SCHEDULABLE_STATUSES } })
          .populate('departmentId', 'name departmentType')
          .lean()
      : projects;

  // Pairwise comparison (n², fine for hackathon-scale data; documented limit).
  const descriptors = [];
  for (let i = 0; i < allProjects.length; i += 1) {
    for (let j = i + 1; j < allProjects.length; j += 1) {
      const d = compareProjects(allProjects[i], allProjects[j]);
      if (d) descriptors.push(d);
    }
  }

  // Index existing conflicts by pair key for duplicate prevention + clearing.
  const existing = await Conflict.find({ conflictType: 'schedule_overlap' }).lean();
  const byKey = new Map(existing.map((c) => [conflictKey(c.projectIds, c.roadSegmentId), c]));

  const touchedIds = new Set();
  let created = 0;
  let reactivated = 0;
  let cleared = 0;

  for (const d of descriptors) {
    // When scanning a subset, only touch conflicts involving the subset.
    if (onlyProjectIds && !d.projectIds.some((id) => onlyProjectIds.includes(String(id)))) continue;

    const key = conflictKey(d.projectIds, d.roadSegmentId);
    const prev = byKey.get(key);

    if (prev) {
      // Duplicate prevention: never create a second record for the same pair.
      touchedIds.add(String(prev._id));
      const patch = {};
      if (prev.overlapStartDate?.getTime() !== d.overlapStartDate.getTime()) patch.overlapStartDate = d.overlapStartDate;
      if (prev.overlapEndDate?.getTime() !== d.overlapEndDate.getTime()) patch.overlapEndDate = d.overlapEndDate;
      if (prev.priority !== d.priority) patch.priority = d.priority;
      if (prev.explanation !== d.explanation) patch.explanation = d.explanation;
      if (!prev.isActive && !['resolved', 'dismissed'].includes(prev.status)) {
        // Schedule change cleared this conflict and the overlap came BACK →
        // reactivate it. Conflicts humans already closed (resolved/dismissed)
        // are never silently reopened by a rescan; that is a human decision.
        patch.isActive = true;
        reactivated += 1;
        await writeAudit({
          actor: null,
          entityType: 'conflict',
          entityId: prev._id,
          action: 'conflict.reactivated',
          newValues: { isActive: true },
          explanation: 'RoadSync re-detection found this overlap is active again.',
        });
      }
      if (Object.keys(patch).length > 0) {
        await Conflict.updateOne({ _id: prev._id }, { $set: patch });
      }
      continue;
    }

    // New conflict → insert. The unique index is the last line of defence
    // against duplicates; the lookup above is the primary guard.
    try {
      const doc = await Conflict.create({ ...d, status: 'unreviewed', isActive: true });
      created += 1;
      touchedIds.add(String(doc._id));
      await writeAudit({
        actor: null,
        entityType: 'conflict',
        entityId: doc._id,
        action: 'conflict.detected',
        newValues: {
          roadSegmentId: d.roadSegmentId,
          overlap: `${d.overlapStartDate.toISOString().slice(0, 10)}..${d.overlapEndDate.toISOString().slice(0, 10)}`,
          priority: d.priority,
        },
        explanation: 'RoadSync automatically detected this potential coordination conflict.',
      });
    } catch (err) {
      if (err.code === 11000) {
        // Raced with a concurrent scan — the duplicate already exists, fine.
      } else {
        throw err;
      }
    }
  }

  // Clear conflicts whose overlap no longer holds (projects rescheduled or
  // completed). Keep the record + its history; only flip the flags.
  if (onlyProjectIds && onlyProjectIds.length) {
    const staleFilter = {
      isActive: true,
      projectIds: { $in: onlyProjectIds },
    };
    const stale = await Conflict.find(staleFilter).lean();
    for (const c of stale) {
      const key = conflictKey(c.projectIds, c.roadSegmentId);
      if (byKey.has(key) && touchedIds.has(String(c._id))) continue;
      const stillValid = descriptors.some(
        (d) => conflictKey(d.projectIds, d.roadSegmentId) === key
      );
      if (!stillValid) {
        await Conflict.updateOne({ _id: c._id }, { $set: { isActive: false } });
        cleared += 1;
        await writeAudit({
          actor: null,
          entityType: 'conflict',
          entityId: c._id,
          action: 'conflict.deactivated',
          newValues: { isActive: false },
          explanation: 'RoadSync re-detection: the schedules no longer overlap. History is preserved.',
        });
      }
    }
  }

  const active = await Conflict.countDocuments({ isActive: true });
  return { created, reactivated, cleared, active, candidates: descriptors.length };
}

/**
 * Re-evaluate conflicts for one project (called after create/update/schedule change).
 */
async function reevaluateProject(projectId) {
  return detectConflicts({ onlyProjectIds: [String(projectId)] });
}

/** Stable key for a project pair + segment. */
function conflictKey(projectIds, segment) {
  const pair = projectIds.map(String).sort().join('|');
  return `${pair}::${String(segment).toUpperCase()}`;
}

module.exports = {
  compareProjects,
  overlapWindow,
  overlapDays,
  priorityFor,
  toUtcDay,
  detectConflicts,
  reevaluateProject,
  SCHEDULABLE_STATUSES,
};
