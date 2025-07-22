const fs = require('fs');
const csv = require('csv-parser');
const User = require('../models/user');
const Sentence = require('../models/sentence');

exports.uploadCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    const sentencesFromCSV = [];
    const filePath = req.file.path;

    await new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (row) => {
          const sentenceText = row.sentence || row.text || Object.values(row)[0];
          if (sentenceText) {
            sentencesFromCSV.push({
              text: sentenceText.trim(),  // Using 'text' instead of 'sentence'
              index: sentencesFromCSV.length
            });
          }
        })
        .on('end', resolve)
        .on('error', reject);
    });

    const existingSentences = await Sentence.find({
      text: { $in: sentencesFromCSV.map(s => s.text) }  // Changed field
    }).select('text');

    const existingSet = new Set(existingSentences.map(s => s.text));

    const newSentences = sentencesFromCSV.filter(s => !existingSet.has(s.text));

    if (newSentences.length > 0) {
      await Sentence.insertMany(newSentences);
    }

    fs.unlinkSync(filePath);

    res.status(200).json({ 
      message: `CSV uploaded: ${newSentences.length} new sentences added, ${existingSet.size} duplicates skipped.` 
    });

  } catch (err) {
    console.error('Upload CSV error:', err);
    res.status(500).json({ message: 'Server error during CSV upload' });
  }
};

exports.assignDataToUser = async (req, res) => {
  try {
    const { userId, startIndex, batchSize } = req.body;

    if (!userId || startIndex === undefined || !batchSize) {
      return res.status(400).json({ message: 'Missing userId, startIndex or batchSize' });
    }

    // Fetch unassigned sentences starting from the specified index
    const sentences = await Sentence.find({ assignedTo: null })
      .skip(startIndex)
      .limit(batchSize);

    if (sentences.length === 0) {
      return res.status(404).json({ message: 'No unassigned sentences found for this batch' });
    }

    const sentenceIds = sentences.map(s => s._id);

    // Assign the selected sentences to the user
    await Sentence.updateMany(
      { _id: { $in: sentenceIds } },
      { $set: { assignedTo: userId } }
    );

    // (Optional) Update user’s assigned data tracker
    await User.findByIdAndUpdate(userId, {
      $addToSet: { assignedIndices: { $each: sentenceIds } }
    });

    res.status(200).json({ message: '✅ 500 sentences assigned successfully.' });
  } catch (err) {
    console.error('Error in assignDataToUser:', err);
    res.status(500).json({ message: 'Server error during assignment' });
  }
};

exports.getUserProgress = async (req, res) => {
  try {
    const { userId } = req.params;
    const totalAssigned = await Sentence.countDocuments({ assignedTo: userId });
    const annotated = await Sentence.countDocuments({
      assignedTo: userId,
      annotations: { $elemMatch: { userId } },
    });

    res.status(200).json({ totalAssigned, annotated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.fetchUsers = async (req, res) => {
  try {
    const users = await User.find({role: 'user'}, 'name email _id');
    res.json(users);
  } catch (err) {
    console.error('Error fetching users:', err);
    res.status(500).json({ message: 'Failed to fetch users' });
  }
};

exports.getAllAssignments = async (req, res) => {
  console.log('Fetching all assignments...');
  try {
    const assignments = await Sentence.aggregate([
      {
        $match: {
          assignedTo: { $ne: null }
        }
      },
      {
        $addFields: {
          annotatedByAssignedUser: {
            $in: ["$assignedTo", {
              $map: {
                input: "$annotations",
                as: "a",
                in: "$$a.userId"
              }
            }]
          }
        }
      },
      {
        $group: {
          _id: "$assignedTo",
          totalAssigned: { $sum: 1 },
          annotated: {
            $sum: {
              $cond: [{ $eq: ["$annotatedByAssignedUser", true] }, 1, 0]
            }
          }
        }
      },
      {
        $lookup: {
          from: "users",
          localField: "_id",
          foreignField: "_id",
          as: "user"
        }
      },
      { $unwind: "$user" },
      {
        $project: {
          userId: "$_id",
          userName: "$user.name",
          userEmail: "$user.email",
          totalAssigned: 1,
          annotated: 1,
          progressPercentage: {
            $round: [
              { $multiply: [{ $divide: ["$annotated", "$totalAssigned"] }, 100] },
              2
            ]
          },
          _id: 0
        }
      },
      { $sort: { userName: 1 } }
    ]);

    res.status(200).json(assignments);
  } catch (err) {
    console.error('Error fetching assignments:', err);
    res.status(500).json({ message: 'Failed to fetch assignments' });
  }
};

exports.getUserAssignments = async (req, res) => {
  try {
    const { userId } = req.params;
    
    const assignments = await Sentence.find({ assignedTo: userId })
      .select('text index annotations')
      .sort({ index: 1 });
    
    const user = await User.findById(userId).select('name email');
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    
    const totalAssigned = assignments.length;
    const annotated = assignments.filter(s => s.annotations.length > 0).length;
    const progressPercentage = totalAssigned > 0 
      ? Math.round((annotated / totalAssigned) * 100) 
      : 0;
    
    res.status(200).json({
      user,
      totalAssigned,
      annotated,
      progressPercentage,
      assignments: assignments.map(a => ({
        id: a._id,
        text: a.text,
        index: a.index,
        isAnnotated: a.annotations.length > 0
      }))
    });
  } catch (err) {
    console.error('Error fetching user assignments:', err);
    res.status(500).json({ message: 'Failed to fetch user assignments' });
  }
};

exports.assignDataToUser = async (req, res) => {
  try {
    const { userId, startIndex, batchSize = 500 } = req.body;

    if (!userId || startIndex === undefined) {
      return res.status(400).json({ message: 'Missing userId or startIndex' });
    }

    if (startIndex % 500 !== 0) {
      return res.status(400).json({ message: 'startIndex must be a multiple of 500' });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const alreadyAssigned = user.assignments.some(
      a => a.batchStart === startIndex
    );
    if (alreadyAssigned) {
      return res.status(400).json({ message: `Batch starting at index ${startIndex} has already been assigned to this user.` });
    }

    const sentences = await Sentence.find({ assignedTo: null })
      .skip(startIndex)
      .limit(batchSize);

    if (sentences.length === 0) {
      return res.status(404).json({ message: 'No unassigned sentences found for this batch' });
    }

    const sentenceIds = sentences.map(s => s._id);
    const batchEnd = startIndex + sentences.length - 1;

    await Sentence.updateMany(
      { _id: { $in: sentenceIds } },
      { $set: { assignedTo: userId } }
    );

    user.assignments.push({
      batchStart: startIndex,
      batchEnd: batchEnd,
      assignedAt: new Date()
    });
    await user.save();

    res.status(200).json({
      message: `✅ ${sentences.length} sentences assigned successfully.`,
      batchStart: startIndex,
      batchEnd: batchEnd
    });
  } catch (err) {
    console.error('Error in assignDataToUser:', err);
    res.status(500).json({ message: 'Server error during assignment' });
  }
};
