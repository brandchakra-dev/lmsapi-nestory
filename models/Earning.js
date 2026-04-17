const mongoose = require('mongoose');

const earningSchema = new mongoose.Schema({
  executive: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  lead: { type: mongoose.Schema.Types.ObjectId, ref: 'Lead', required: true },
  amount: { type: Number, required: true },
  type: { type: String, enum: ['commission','bonus','manual'], default: 'commission' },
  status: { type: String, enum: ['pending','approved','paid','rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Earning', earningSchema);
