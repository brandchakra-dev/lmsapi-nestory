const mongoose = require("mongoose");

const settingSchema = new mongoose.Schema({
  officeLat: { type: Number, required: true },
  officeLng: { type: Number, required: true },
  allowedRadius: { type: Number, default: 200 }, // meters
}, { timestamps: true });

module.exports = mongoose.model("Setting", settingSchema);
