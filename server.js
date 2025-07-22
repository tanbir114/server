// File: server.js
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');

const adminRoutes = require('./routes/admin');
const userRoutes = require('./routes/user');
const authRoutes = require('./routes/auth');

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join("public")));

console.log(__dirname);




mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error(err));

app.use('/api/admin', adminRoutes);
app.use('/api/user', userRoutes);
app.use('/api/auth', authRoutes);



app.use("/", (req, res) => {
    res.sendFile(path.resolve(__dirname, "public", "index.html"));
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// module.exports.handler = serverless(app);
// file name changed
