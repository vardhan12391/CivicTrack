const mongoose = require('mongoose');

const DEPARTMENT_TYPES = ['water', 'roads', 'drainage', 'electricity', 'gas', 'telecom', 'other'];

const departmentSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Department name is required'], unique: true, trim: true, maxlength: 120 },
    departmentType: { type: String, enum: DEPARTMENT_TYPES, required: true },
    description: { type: String, trim: true, maxlength: 1000, default: '' },
    contactEmail: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Department', departmentSchema);
module.exports.DEPARTMENT_TYPES = DEPARTMENT_TYPES;
