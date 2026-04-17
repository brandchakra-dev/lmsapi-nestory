const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  date: {
    type: String, // YYYY-MM-DD
    required: true
  },

  punchIn: Date,
  punchOut: Date,

  totalHours: Number,

  status: {
    type: String,
    enum: ["present", "absent", "half-day", "late"],
    default: "present"
  },

  ipAddress: String,
  
  location: {
    lat: Number,
    lng: Number
  },

  createdAt: {
    type: Date,
    default: Date.now
  }
});

attendanceSchema.index({ user: 1, date: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
