const mongoose = require('mongoose');

const UPDATE_TYPES = ['progress', 'delay', 'schedule_change', 'completion', 'general'];

const updateSchema = new mongoose.Schema(
  {
    projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true, index: true },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    updateType: { type: String, enum: UPDATE_TYPES, default: 'general' },
    message: { type: String, required: true, trim: true, maxlength: 3000 },
    // Attachments are *submitted* evidence; verified stays false until an
    // official explicitly marks it as independently verified.
    evidence: [
      {
        url: String,
        caption: String,
        verified: { type: Boolean, default: false },
      },
    ],
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

module.exports = mongoose.model('ProjectUpdate', updateSchema);
module.exports.UPDATE_TYPES = UPDATE_TYPES;
