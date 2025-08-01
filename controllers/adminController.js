const fs = require('fs');
const csv = require('csv-parser');
const User = require('../models/user');
const Sentence = require('../models/sentence');

exports.uploadCSV = async (req, res) => {
  let filePath;
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    filePath = req.file.path;
    const sentencesFromCSV = [];

    // Read CSV rows
    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const sentenceText = row.sentence || row.text || Object.values(row)[0];
          if (sentenceText && String(sentenceText).trim().length > 0) {
            sentencesFromCSV.push({
              text: String(sentenceText).trim()
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    if (sentencesFromCSV.length === 0) {
      return res.status(400).json({ message: 'No valid rows found in CSV.' });
    }

    // Deduplicate by text against existing DB
    const allTexts = sentencesFromCSV.map(s => s.text);
    const existingSentences = await Sentence.find({ text: { $in: allTexts } })
      .select('text')
      .lean();

    const existingSet = new Set(existingSentences.map(s => s.text));
    const newTexts = sentencesFromCSV
      .map(s => s.text)
      .filter((t, i, arr) => arr.indexOf(t) === i) // in-file dedupe
      .filter(t => !existingSet.has(t));           // DB dedupe

    if (newTexts.length === 0) {
      return res.status(200).json({
        message: `CSV uploaded: 0 new sentences added, ${existingSet.size} duplicates skipped.`
      });
    }

    // Get current max index and assign indices sequentially
    const maxIndexDoc = await Sentence.findOne({}, { index: 1 })
      .sort({ index: -1 })
      .lean();
    let nextIndex = (maxIndexDoc?.index ?? -1) + 1;

    const docsToInsert = newTexts.map(text => ({
      text,
      index: nextIndex++
    }));

    await Sentence.insertMany(docsToInsert);

    return res.status(200).json({
      message: `CSV uploaded: ${docsToInsert.length} new sentences added, ${existingSet.size} duplicates skipped.`
    });
  } catch (err) {
    console.error('Upload CSV error:', err);
    return res.status(500).json({ message: 'Server error during CSV upload' });
  } finally {
    // best-effort cleanup
    if (filePath) {
      try { fs.unlinkSync(filePath); } catch {}
    }
  }
};

exports.getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;

    // Get total assigned from user's assignments
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const totalAssigned = user.assignments.reduce((sum, assignment) => {
      return sum + (assignment.batchSize || (assignment.batchEnd - assignment.batchStart + 1));
    }, 0);

    const annotated = await Sentence.countDocuments({
      assignedTo: userId,
      annotations: { $elemMatch: { userId: userId } }
    });

    return res.status(200).json({ 
      totalAssigned,
      annotated,
      progressPercentage: totalAssigned > 0 
        ? Math.round((annotated / totalAssigned) * 100) 
        : 0
    });
  } catch (err) {
    console.error('getUserProgress error:', err);
    return res.status(500).json({ error: err.message });
  }
};

exports.fetchUsers = async (req, res) => {
  try {
    const users = await User.find({ role: 'user' }, 'name email _id');
    return res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    return res.status(500).json({ message: 'Failed to fetch users' });
  }
};

exports.getAllAssignments = async (req, res) => {
  try {
    // First get all users
    const users = await User.find({ role: 'user' }).lean();
    
    // Then get assignment stats for each user
    const assignments = await Promise.all(users.map(async (user) => {
      // Calculate total assigned from batch assignments
      const totalAssigned = user.assignments.reduce((sum, assignment) => {
        return sum + (assignment.batchSize || (assignment.batchEnd - assignment.batchStart + 1));
      }, 0);

      // Count how many sentences this user has annotated
      const annotated = await Sentence.countDocuments({
        assignedTo: user._id,
        'annotations.userId': user._id
      });

      return {
        userId: user._id,
        userName: user.name,
        userEmail: user.email,
        totalAssigned,
        annotated,
        progressPercentage: totalAssigned > 0 
          ? Math.round((annotated / totalAssigned) * 100)
          : 0
      };
    }));

    // Sort by name
    assignments.sort((a, b) => a.userName.localeCompare(b.userName));

    return res.status(200).json(assignments);
  } catch (err) {
    console.error("Error fetching assignments:", err);
    return res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

exports.getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).lean();
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Calculate total assigned from batch assignments
    const totalAssigned = user.assignments.reduce((sum, assignment) => {
      return sum + (assignment.batchSize || (assignment.batchEnd - assignment.batchStart + 1));
    }, 0);

    const annotated = await Sentence.countDocuments({
      assignedTo: userId,
      'annotations.userId': userId
    });

    return res.status(200).json({ 
      totalAssigned,
      annotated,
      progressPercentage: totalAssigned > 0 
        ? Math.round((annotated / totalAssigned) * 100)
        : 0
    });
  } catch (err) {
    console.error('getUserProgress error:', err);
    return res.status(500).json({ error: err.message });
  }
};

exports.getUserAssignments = async (req, res) => {
  try {
    const { userId } = req.params;

    const [user, sentences] = await Promise.all([
      User.findById(userId).select('name email assignments').lean(),
      Sentence.find({ assignedTo: userId })
        .select('text index annotations')
        .sort({ index: 1 })
        .lean()
    ]);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Calculate total assigned from batch assignments
    const totalAssigned = user.assignments.reduce((sum, assignment) => {
      return sum + (assignment.batchSize || (assignment.batchEnd - assignment.batchStart + 1));
    }, 0);

    const annotated = sentences.filter(s =>
      (s.annotations || []).some(a => String(a.userId) === String(userId)
    ).length);

    const progressPercentage = totalAssigned > 0
      ? Math.round((annotated / totalAssigned) * 100)
      : 0;

    return res.status(200).json({
      user,
      totalAssigned,
      annotated,
      progressPercentage,
      assignments: sentences.map(a => ({
        id: a._id,
        text: a.text,
        index: a.index,
        isAnnotated: (a.annotations || []).some(x => String(x.userId) === String(userId))
      }))
    });
  } catch (err) {
    console.error('Error fetching user assignments:', err);
    return res.status(500).json({ message: 'Failed to fetch user assignments' });
  }
};

exports.assignDataToUser = async (req, res) => {
  try {
    let { userId, startIndex, batchSize = 500 } = req.body;

    // validate
    if (!userId || startIndex === undefined) {
      return res.status(400).json({ message: 'Missing userId or startIndex' });
    }

    startIndex = Number(startIndex);
    batchSize = Number(batchSize);

    if (!Number.isInteger(startIndex) || startIndex < 0) {
      return res.status(400).json({ message: 'startIndex must be a non-negative integer' });
    }
    if (!Number.isInteger(batchSize) || batchSize <= 0) {
      return res.status(400).json({ message: 'batchSize must be a positive integer' });
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const rangeStart = startIndex;
    const rangeEnd = startIndex + batchSize - 1;

    // Fetch full range
    const sentencesInRange = await Sentence.find(
      { index: { $gte: rangeStart, $lte: rangeEnd } },
      '_id index assignedTo'
    ).lean();

    if (sentencesInRange.length === 0) {
      return res.status(404).json({
        message: `No sentences exist in index range ${rangeStart}–${rangeEnd}.`
      });
    }

    // classify
    const isSameId = (a, b) => String(a) === String(b);

    const unassigned = sentencesInRange.filter(s => !s.assignedTo);
    const assignedToUser = sentencesInRange.filter(
      s => s.assignedTo && isSameId(s.assignedTo, userId)
    );
    const assignedToOthers = sentencesInRange.filter(
      s => s.assignedTo && !isSameId(s.assignedTo, userId)
    );

    // double-assignment: if user already has this batch recorded
    const existingAssignment = user.assignments.find(
      a => a.batchStart === rangeStart && a.batchEnd === rangeEnd
    );

    if (existingAssignment) {
      // if some data points are missing, fill them
      if (unassigned.length > 0) {
        await Sentence.updateMany(
          { _id: { $in: unassigned.map(s => s._id) } },
          { $set: { assignedTo: userId } }
        );

        // optional: refresh user.assignedIndices
        await User.findByIdAndUpdate(userId, {
          $addToSet: { assignedIndices: { $each: unassigned.map(s => s._id) } }
        });

        return res.status(200).json({
          message: `Gap fill complete. ${unassigned.length} missing sentences assigned.`,
          batchStart: rangeStart,
          batchEnd: rangeEnd,
          newlyAssigned: unassigned.length
        });
      }

      // No missing data → everything already assigned
      return res.status(200).json({
        message: `This batch (${rangeStart}-${rangeEnd}) is already fully assigned.`,
        batchStart: rangeStart,
        batchEnd: rangeEnd
      });
    }

    // Normal new assignment (not seen before)
    if (unassigned.length > 0) {
      await Sentence.updateMany(
        { _id: { $in: unassigned.map(s => s._id) } },
        { $set: { assignedTo: userId } }
      );

      // track sentence IDs
      await User.findByIdAndUpdate(userId, {
        $addToSet: { assignedIndices: { $each: unassigned.map(s => s._id) } }
      });
    }

    // Add new assignment record
    user.assignments.push({
      batchStart: rangeStart,
      batchEnd: rangeEnd,
      batchSize,
      assignedAt: new Date(),
      completed: false
    });
    await user.save();

    return res.status(200).json({
      message: 'Assignment processed.',
      batchStart: rangeStart,
      batchEnd: rangeEnd,
      newlyAssigned: unassigned.length,
      duplicatesAlreadyOwned: assignedToUser.length,
      conflictsAssignedToOthers: assignedToOthers.length
    });
  } catch (err) {
    console.error('Error in assignDataToUser:', err);
    return res.status(500).json({ message: 'Server error during assignment' });
  }
};
