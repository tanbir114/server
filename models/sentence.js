const mongoose = require('mongoose');

const sentenceSchema = new mongoose.Schema({
  text: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: v => v && v.trim().length > 0,
      message: "Sentence text cannot be empty"
    }
  },
  index: {
    type: Number,
    required: true
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null
  },
  annotations: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    labels: [String],
    createdAt: { type: Date, default: Date.now }
  }]
}, { timestamps: true });

sentenceSchema.index({ index: 1 }, { unique: true });      
sentenceSchema.index({ assignedTo: 1 });
sentenceSchema.index({ assignedTo: 1, index: 1 });

module.exports = mongoose.model('Sentence', sentenceSchema);