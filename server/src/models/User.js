const mongoose = require('mongoose');

const ROLES = ['citizen', 'official', 'administrator'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, minlength: 2, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    // Stored as a bcrypt hash — plaintext passwords are never persisted.
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'citizen' },
    // Required only for officials: which department they belong to.
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Never serialize the hash, even when explicitly selected.
userSchema.set('toJSON', {
  transform(_doc, ret) {
    delete ret.passwordHash;
    return ret;
  },
});

module.exports = mongoose.model('User', userSchema);
module.exports.ROLES = ROLES;
