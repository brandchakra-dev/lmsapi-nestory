require('dotenv').config();
const app = require('./app');
const mongoose = require('mongoose');
const http = require('http');

if (process.env.NODE_ENV !== "production") {
  require("dotenv").config();
}

const PORT = process.env.PORT || 5000;

const server = http.createServer(app);

mongoose.connect(process.env.MONGO_URI)
.then(() => {
  console.log('MongoDB connected');
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
})
.catch((err) => {
  console.error('MongoDB connection error:', err);
});

