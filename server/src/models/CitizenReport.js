const mongoose = require('mongoose');

const REPORT_CATEGORIES = [
  'damaged_road', 'stalled_construction', 'poor_workmanship', 'drainage',
  'repeated_excavation', 'unsafe_condition', 'other',
];
const REPORT_STATUSES = ['submitted', 'under_review', 'assigned', 'in_progress', 'resolved', 'rejected'];

const pointSchema = new mongoose.Schema(
  { type: { type: String, enum: ['Point'], default: 'Point' }, coordinates: { type: [Number], default: undefined } },
  { _id: false }
);

const citizenReportSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
    description: { type: String, required: true, minlength: 15, maxlength: 4000 },
    category: { type: String, enum: REPORT_CATEGORIES, required: true },
    location: {
      address: { type: String, required: true, trim: true, maxlength: 300 },
      ward: { type: String, trim: true, maxlength: 60, default: '' },
      point: { type: pointSchema, default: undefined },
    },
    roadSegmentId: { type: String, trim: true, uppercase: true, maxlength: 60, default: '' },
    images: [{ url: String, caption: String, uploadedAt: { type: Date, default: Date.now } }],
    citizenId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    assignedDepartmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    linkedProjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', default: null },
    status: { type: String, enum: REPORT_STATUSES, default: 'submitted', index: true },
    officialResponse: { type: String, trim: true, maxlength: 3000, default: '' },
    resolutionNotes: { type: String, trim: true, maxlength: 2000, default: '' },
    statusHistory: [
      {
        status: String,
        changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        note: String,
        at: { type: Date, default: Date.now },
        _id: false,
      },
    ],
  },
  { timestamps: true }
);

citizenReportSchema.index({ 'location.point': '2dsphere' });

module.exports = mongoose.model('CitizenReport', citizenReportSchema);
module.exports.REPORT_CATEGORIES = REPORT_CATEGORIES;
module.exports.REPORT_STATUSES = REPORT_STATUSES;
