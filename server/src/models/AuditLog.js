const mongoose = require('mongoose');

const ENTITY_TYPES = ['project', 'conflict', 'report', 'user', 'department', 'milestone'];

/**
 * Append-only audit log.
 * There is deliberately NO update or delete path exposed by the API:
 * ordinary users (and officials) cannot rewrite history.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    actorRole: { type: String, enum: ['citizen', 'official', 'administrator', 'system'], required: true },
    entityType: { type: String, enum: ENTITY_TYPES, required: true, index: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true, index: true },
    action: { type: String, required: true, index: true }, // e.g. "project.schedule_revised"
    previousValues: { type: mongoose.Schema.Types.Mixed, default: null },
    newValues: { type: mongoose.Schema.Types.Mixed, default: null },
    explanation: { type: String, trim: true, maxlength: 2000, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ entityType: 1, entityId: 1, createdAt: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);
module.exports.ENTITY_TYPES = ENTITY_TYPES;
