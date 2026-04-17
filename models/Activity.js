const mongoose = require('mongoose');

const activitySchema = new mongoose.Schema({
    action: String,
    details: String,
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    lead: { type: mongoose.Schema.Types.ObjectId, ref: "Lead" },
    date: { type: Date, default: Date.now }
  });
  
  module.exports = mongoose.model("Activity", activitySchema);
  