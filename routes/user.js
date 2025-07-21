const express = require('express');
const { getAssignedSentences, annotateSentence } = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');
const router = express.Router();

router.get('/assigned-sentences/:userId', authMiddleware(['user']), getAssignedSentences);
router.post('/annotate/:sentenceId', authMiddleware(['user']), annotateSentence);

module.exports = router;
