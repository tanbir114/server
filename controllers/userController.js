const Sentence = require("../models/sentence");
const mongoose = require("mongoose");
const User = require("../models/user");

exports.getAssignedSentences = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    // Get user with incomplete assignments
    const user = await User.findById(userId).select("assignments");
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Get all incomplete assignments
    const incompleteAssignments = user.assignments.filter((a) => !a.completed);

    if (incompleteAssignments.length === 0) {
      return res.status(200).json([]);
    }

    // Create an array of index ranges to query
    const indexRanges = incompleteAssignments.map((a) => ({
      $gte: a.batchStart,
      $lte: a.batchEnd,
    }));

    // Get sentences in all assigned ranges
    const sentences = await Sentence.find({
      $or: indexRanges.map((range) => ({ index: range })),
    })
      .select("text index annotations")
      .sort({ index: 1 });

    console.log(
      `Found ${sentences.length} sentences across ${incompleteAssignments.length} batches`
    );

    res.status(200).json(sentences);
  } catch (err) {
    console.error("Error in getAssignedSentences:", err);
    res.status(500).json({ message: "Server error fetching sentences" });
  }
};

exports.annotateSentence = async (req, res) => {
  try {
    const { sentenceId } = req.params;
    const { userId, labels } = req.body;

    // Validate input
    if (!sentenceId || !mongoose.Types.ObjectId.isValid(sentenceId)) {
      return res.status(400).json({ message: "Invalid sentenceId" });
    }

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid userId" });
    }

    if (!Array.isArray(labels)) {
      return res
        .status(400)
        .json({ message: "Labels must be a non-empty array" });
    }

    // Fetch sentence
    const sentence = await Sentence.findById(sentenceId);
    if (!sentence) {
      return res.status(404).json({ message: "Sentence not found" });
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
    res.status(200).json({ message: "Annotation saved successfully" });
  } catch (err) {
    console.error("Error in annotateSentence:", err);
    res.status(500).json({ message: "Server error saving annotation" });
  }
};
