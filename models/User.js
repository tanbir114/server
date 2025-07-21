const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  name: String,
  email: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  role: { type: String, enum: ['admin', 'user'], default: 'user' },

  assignedIndices: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Sentence'
  }],
  assignments: [{
    batchStart: { 
      type: Number,
      validate: {
        validator: v => v % 500 === 0,
        message: 'Batch start must be multiple of 500'
      }
    },
    batchEnd: Number,
    assignedAt: { type: Date, default: Date.now },
    completed: { type: Boolean, default: false }
  }]
}, { timestamps: true });


module.exports = mongoose.model('User', userSchema);
