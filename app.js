const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');

const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const leadRoutes = require('./routes/leadRoutes');
const earningRoutes = require('./routes/earningRoutes');
const reportRoutes = require('./routes/reportRoutes');

const attendanceRoutes = require('./routes/attendanceRoutes');
const projectRoutes = require('./routes/projectRoutes');

const  followupRoutes =  require('./routes/followupRoutes');

const errorHandler = require('./middleware/errorHandler');

const app = express();

app.use(cors());

app.use(morgan('dev'));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// routes
app.use("/uploads", express.static("uploads"));

app.get("/", (req, res) => {
  res.status(200).send("API Running");
});

app.get("/api/health", (req, res) => {
  res.status(200).send("OK");
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/leads', leadRoutes);
app.use('/api/earnings', earningRoutes);

app.use("/api/attendance", attendanceRoutes);

app.use("/api/project", projectRoutes);

app.use('/api/reports', reportRoutes);

app.use('/api/followups', followupRoutes);

app.use(errorHandler);

module.exports = app;
