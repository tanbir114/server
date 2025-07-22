// File: api/server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const serverless = require('serverless-http');

dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

// Routes
const adminRoutes = require('../routes/admin');
const userRoutes = require('../routes/user');
const authRoutes = require('../routes/auth');

app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);

// Catch-all for frontend routes
app.get('*', (req, res) => {
  res.sendFile(path.resolve(__dirname, "../public", "index.html"));
});

// MongoDB Connection (on cold start)
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

// Export serverless handler
module.exports = serverless(app);
