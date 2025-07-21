const Sentence = require('../models/Sentence');

exports.getAssignedSentences = async (req, res) => {
  try {
    const { userId } = req.params;
    const sentences = await Sentence.find({ assignedTo: userId })
      .select('text index annotations')  // Using 'text' field
      .sort({ index: 1 });
    res.status(200).json(sentences);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.annotateSentence = async (req, res) => {
  try {
    const { sentenceId } = req.params;
    const { userId, labels } = req.body;

    if (!Array.isArray(labels) || labels.length === 0) {
      return res.status(400).json({ message: 'Labels must be a non-empty array' });
    }

    const sentence = await Sentence.findById(sentenceId);
    if (!sentence) return res.status(404).json({ message: 'Sentence not found' });

    const existingAnnotation = sentence.annotations.find(
      a => a.userId.toString() === userId
    );

    if (existingAnnotation) {
      existingAnnotation.labels = labels;
    } else {
      sentence.annotations.push({ userId, labels });
    }

    await sentence.save();
    res.status(200).json({ message: 'Annotation saved' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};