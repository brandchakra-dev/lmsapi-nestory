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
const webhookRoutes = require("./routes/webhookRoutes");

const errorHandler = require('./middleware/errorHandler');

const app = express();

// ── CORS configuration for production and development
const allowedOrigins = process.env.NODE_ENV === 'production'
  ? ['https://lms.thenestory.in', 'https://thenestory.in', 'https://www.thenestory.in']
  : ['http://localhost:3000', 'http://localhost:5173', 'http://localhost:5000'];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin) || process.env.NODE_ENV !== 'production') {
      callback(null, true);
    } else {
      console.log('Blocked origin:', origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,  // ✅ Important for cookies
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie', 'Accept', 'X-Requested-With'],
  exposedHeaders: ['Set-Cookie'],
};

app.use(cors(corsOptions));

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

app.use("/api/webhook", webhookRoutes);

app.use(errorHandler);

module.exports = app;
