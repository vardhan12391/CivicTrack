const AuditLog = require('../models/AuditLog');

/**
 * Write an audit entry. This is the ONLY way audit records are created —
 * nothing in the codebase updates or deletes them.
 *
 * @param {object} params
 * @param {object|null} params.actor    req.user (or null for system actions)
 * @param {string} params.entityType    project | conflict | report | user | department | milestone
 * @param {string|object} params.entityId
 * @param {string} params.action        e.g. "project.schedule_revised"
 * @param {object} [params.previousValues]
 * @param {object} [params.newValues]
 * @param {string} [params.explanation] Human-readable reason (required for schedule changes)
 */
async function writeAudit({ actor, entityType, entityId, action, previousValues = null, newValues = null, explanation = '' }) {
  try {
    return await AuditLog.create({
      actorId: actor?._id || actor?.id || null,
      actorRole: actor?.role || 'system',
      entityType,
      entityId,
      action,
      previousValues,
      newValues,
      explanation,
    });
  } catch (err) {
    // An audit failure must never break the user's action, but it should be
    // visible to operators.
    console.error('[audit] failed to write entry:', err.message);
    return null;
  }
}

/** Fetch the timeline for one entity, newest first. */
async function getEntityTimeline(entityType, entityId, limit = 100) {
  return AuditLog.find({ entityType, entityId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate('actorId', 'name email role')
    .lean()
    .then((entries) =>
      entries.map((e) => ({
        _id: e._id,
        actor: e.actorId,
        actorRole: e.actorRole,
        action: e.action,
        previousValues: e.previousValues,
        newValues: e.newValues,
        explanation: e.explanation,
        createdAt: e.createdAt,
      }))
    );
}

module.exports = { writeAudit, getEntityTimeline };
