const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true, trim: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  // Optional: track specific sentence IDs the user has ever been assigned
  assignedIndices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sentence'
  }],

  assignments: [{
    batchStart: { type: Number, required: true },
    batchEnd: { type: Number, required: true },
    batchSize: { type: Number },
    assignedAt: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false }
  }]
}, { timestamps: true });

userSchema.index({ email: 1 }, { unique: true });
userSchema.index({ 'assignments.batchStart': 1 });

module.exports = mongoose.model('User', userSchema);