const express = require('express');
const router = express.Router();
const multer = require('multer');
const { uploadCSV, assignDataToUser, getUserProgress, fetchUsers, getAllAssignments, getUserAssignments} = require('../controllers/adminController');
const authMiddleware = require('../middleware/authMiddleware');

const upload = multer({ dest: 'uploads/' });

router.post('/upload-csv', authMiddleware(['admin']), upload.single('file'), uploadCSV);
router.post('/assign/', authMiddleware(['admin']), assignDataToUser);
router.get('/progress/:userId', authMiddleware(['admin']), getUserProgress);
router.get('/users', authMiddleware(['admin']), fetchUsers);
router.get('/assignments', authMiddleware(['admin']), getAllAssignments);
router.get('/assignments/:userId', authMiddleware(['admin']), getUserAssignments);

module.exports = router;
