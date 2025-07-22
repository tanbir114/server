const mongoose = require('mongoose');

const sentenceSchema = new mongoose.Schema({
  text: { 
    type: String, 
    required: true,
    validate: {
      validator: v => v && v.trim().length > 0,
      message: "Sentence text cannot be empty"
    }
  },  // Changed from 'sentence' to 'text'
  index: Number,
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

module.exports = mongoose.model('Sentence', sentenceSchema);
