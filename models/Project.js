const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  address: {
    type: String,
    required: true
  },

  location: {
    lat: Number,
    lng: Number
  },

  brochure: {
    type: String // file path / URL
  },

  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  },
  
  assignedTo: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User"
    }
  ],

  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active"
  },

}, { timestamps: true });

module.exports = mongoose.model("Project", projectSchema);
