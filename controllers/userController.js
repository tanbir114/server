const Sentence = require('../models/sentence');
const mongoose = require('mongoose');

exports.getAssignedSentences = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    const sentences = await Sentence.find({ assignedTo: userId })
      .select('text index annotations')
      .sort({ index: 1 });

    res.status(200).json(sentences);
  } catch (err) {
    console.error('Error in getAssignedSentences:', err);
    res.status(500).json({ message: 'Server error fetching sentences' });
  }
};

exports.annotateSentence = async (req, res) => {
  try {
    const { sentenceId } = req.params;
    const { userId, labels } = req.body;

    // Validate input
    if (!sentenceId || !mongoose.Types.ObjectId.isValid(sentenceId)) {
      return res.status(400).json({ message: 'Invalid sentenceId' });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: 'Invalid userId' });
    }

    if (!Array.isArray(labels)) {
      return res.status(400).json({ message: 'Labels must be a non-empty array' });
    }

    // Fetch sentence
    const sentence = await Sentence.findById(sentenceId);
    if (!sentence) {
      return res.status(404).json({ message: 'Sentence not found' });
    }

    // Find existing annotation
    const existingAnnotationIndex = sentence.annotations.findIndex(
      (a) => a.userId.toString() === userId.toString()
    );

    if (existingAnnotationIndex !== -1) {
      // Update existing annotation
      sentence.annotations[existingAnnotationIndex].labels = labels;
    } else {
      // Add new annotation
      sentence.annotations.push({
        userId: new mongoose.Types.ObjectId(userId),
        labels,
      });
    }

    await sentence.save();
    res.status(200).json({ message: 'Annotation saved successfully' });

  } catch (err) {
    console.error('Error in annotateSentence:', err);
    res.status(500).json({ message: 'Server error saving annotation' });
  }
};