const mongoose = require('mongoose');

const PROJECT_CATEGORIES = [
  'road', 'drainage', 'water_pipeline', 'sewage', 'electricity',
  'streetlight', 'telecom', 'gas', 'other',
];
const PROJECT_STATUSES = ['planned', 'active', 'delayed', 'completed', 'cancelled'];

/**
 * Normalise a road segment identifier so the same physical road is always
 * spelled the same way: upper case, spaces/underscores become hyphens,
 * no duplicate/edge hyphens.  "main road 01" === "MAIN-ROAD-01" === "MAIN__ROAD_01".
 */
function normalizeRoadSegment(value) {
  if (!value) return '';
  return String(value)
    .trim()
    .toUpperCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

const pointSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Point'], default: 'Point' },
    coordinates: { type: [Number], default: undefined }, // [lng, lat]
  },
  { _id: false }
);

const projectSchema = new mongoose.Schema(
  {
    title: { type: String, required: [true, 'Title is required'], trim: true, minlength: 5, maxlength: 160 },
    description: { type: String, required: [true, 'Description is required'], minlength: 20, maxlength: 5000 },
    category: { type: String, enum: PROJECT_CATEGORIES, required: true },
    roadSegmentId: {
      type: String,
      required: [true, 'Road segment ID is required'],
      trim: true,
      uppercase: true,
      set: normalizeRoadSegment,
      index: true,
    },
    location: {
      address: { type: String, trim: true, maxlength: 300, default: '' },
      ward: { type: String, trim: true, maxlength: 60, default: '' },
      point: { type: pointSchema, default: undefined },
    },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true, index: true },
    assignedOfficerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    contractorName: { type: String, trim: true, maxlength: 160, default: '' },
    budget: { type: Number, min: 0, default: 0 },
    currency: { type: String, default: 'INR', maxlength: 8 },
    startDate: { type: Date, required: true },
    plannedEndDate: { type: Date, required: true }, // the ORIGINAL public deadline
    revisedEndDate: { type: Date, default: null },  // only set with a documented reason
    status: { type: String, enum: PROJECT_STATUSES, default: 'planned', index: true },
    delayExplanation: { type: String, trim: true, maxlength: 2000, default: '' },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

projectSchema.index({ title: 'text', description: 'text', contractorName: 'text' });
projectSchema.index({ 'location.point': '2dsphere' });
projectSchema.index({ plannedEndDate: 1 });

/**
 * Computed: is this project overdue?
 * A project is overdue when its effective end date (revised if present,
 * otherwise the original planned end) has passed in UTC calendar days and the
 * project is neither completed nor cancelled.
 */
projectSchema.virtual('isOverdue').get(function isOverdue() {
  if (this.status === 'completed' || this.status === 'cancelled') return false;
  const effective = this.revisedEndDate || this.plannedEndDate;
  if (!effective) return false;
  const now = new Date();
  const todayUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return effective < todayUtc;
});

/** The date RoadSync should use as "the end of scheduled work". */
projectSchema.virtual('effectiveEndDate').get(function effectiveEndDate() {
  return this.revisedEndDate || this.plannedEndDate;
});

module.exports = mongoose.model('Project', projectSchema);
module.exports.PROJECT_CATEGORIES = PROJECT_CATEGORIES;
module.exports.PROJECT_STATUSES = PROJECT_STATUSES;
module.exports.normalizeRoadSegment = normalizeRoadSegment;
