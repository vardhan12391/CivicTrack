const mongoose = require('mongoose');

const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'skipped'];

const evidenceSchema = new mongoose.Schema(
  {
    url: { type: String, default: '' },
    caption: { type: String, trim: true, maxlength: 300, default: '' },
    // IMPORTANT: uploading evidence does NOT mean the work was verified.
    verified: { type: Boolean, default: false },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    verifiedAt: { type: Date, default: null },
  },
  { _id: false }
);

const milestoneSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    dueDate: { type: Date, required: true },
    status: { type: String, enum: MILESTONE_STATUSES, default: 'pending' },
    completedAt: { type: Date, default: null },
    evidence: { type: evidenceSchema, default: () => ({}) },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Milestone', milestoneSchema);
module.exports.MILESTONE_STATUSES = MILESTONE_STATUSES;
