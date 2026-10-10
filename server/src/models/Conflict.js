const mongoose = require('mongoose');

const CONFLICT_TYPES = ['schedule_overlap', 'revisit_risk'];
const CONFLICT_STATUSES = ['unreviewed', 'under_review', 'resolved', 'dismissed'];
const CONFLICT_PRIORITIES = ['low', 'medium', 'high'];

const conflictSchema = new mongoose.Schema(
  {
    // Always exactly two project ids (sorted ascending to keep pairs canonical).
    projectIds: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Project' }],
      required: true,
      validate: {
        validator: (v) => Array.isArray(v) && v.length === 2 && String(v[0]) !== String(v[1]),
        message: 'A conflict must reference two different projects',
      },
    },
    conflictType: { type: String, enum: CONFLICT_TYPES, default: 'schedule_overlap' },
    roadSegmentId: { type: String, required: true, uppercase: true, trim: true, index: true },
    departmentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Department' }],
    overlapStartDate: { type: Date, required: true },
    overlapEndDate: { type: Date, required: true },
    explanation: { type: String, required: true, maxlength: 2000 },
    priority: { type: String, enum: CONFLICT_PRIORITIES, default: 'medium' },
    status: { type: String, enum: CONFLICT_STATUSES, default: 'unreviewed', index: true },
    // True while the underlying projects still produce this overlap. A conflict
    // that stops being "active" is kept for history, never deleted.
    isActive: { type: Boolean, default: true, index: true },
    reviewNote: { type: String, trim: true, maxlength: 2000, default: '' },
    // Append-only history of every review action on this conflict.
    reviewNotes: [
      {
        status: String,
        note: String,
        by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolution: { type: String, trim: true, maxlength: 2000, default: '' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    resolvedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Cheap duplicate guard at the database level (same pair + segment + type).
conflictSchema.index(
  { conflictType: 1, roadSegmentId: 1, projectIds: 1 },
  { unique: true }
);

module.exports = mongoose.model('Conflict', conflictSchema);
module.exports.CONFLICT_TYPES = CONFLICT_TYPES;
module.exports.CONFLICT_STATUSES = CONFLICT_STATUSES;
module.exports.CONFLICT_PRIORITIES = CONFLICT_PRIORITIES;
