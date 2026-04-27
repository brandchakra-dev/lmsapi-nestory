const mongoose = require('mongoose');

const followUpSchema = new mongoose.Schema({
  followUpAt:      { type: Date, required: true },
  nextFollowUpAt:  { type: Date },
  note:            { type: String, required: true, trim: true },
  createdBy:       { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt:       { type: Date, default: Date.now },
  completed:       { type: Boolean, default: false },
  completedAt:     { type: Date },
  completionNotes: { type: String, trim: true }
}, { _id: true });

const remarkSchema = new mongoose.Schema({
  remarkAt:  { type: Date, required: true },
  text:      { type: String, required: true, trim: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  from:      String,
  to:        String,
  reason:    String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  date:      { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  bookingAmount:   Number,
  bookingDate:     Date,
  paymentMode:     String,
  agreementNumber: String,
  possessionDate:  Date,
  unitNumber:      String,
  floorNumber:     String,
  additionalNotes: String
});

const leadSchema = new mongoose.Schema({
  name:    { type: String, required: true },
  phone:   { type: String, required: true },
  email:   { type: String },
  source:  { type: String },

  // ✅ FIX 1: support both string (manual leads) and object (FB mapped leads)
  details: { type: mongoose.Schema.Types.Mixed, default: {} },

  // 🏠 Project / property fields
  projectName:      { type: String },
  projectCity:      { type: String },
  budget:           { type: String },
  typeOfResidence:  {
    type: String,
    enum: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa', 'Penthouse', 'Plot', 'Other']
  },

  // 📊 Lead workflow
  status: {
    type: String,
    enum: ['new', 'visited', 'booked', 'active', 'inactive', 'closed', 'followup'],
    default: 'new'
  },
  inactiveReason:  String,
  inactiveDate:    Date,
  bookingDetails:  bookingSchema,

  // 📅 Follow-ups and remarks
  followUps:     [followUpSchema],
  remarks:       [remarkSchema],
  statusHistory: [statusHistorySchema],

  // 🧑‍💼 User relationships
  createdBy:         { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedManager:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedDate:      { type: Date, default: Date.now },

  // 🕒 Metadata
  createdAt:      { type: Date, default: Date.now },
  updatedAt:      { type: Date, default: Date.now },
  nextFollowUpDate: { type: Date },

  // 📘 Facebook fields
  fbLeadId:    { type: String },   // ✅ FIX 4: unique index added below
  fbRawData:   { type: Object },
  fbAdName:    { type: String },
  fbAdsetName: { type: String },
});

// ─── Indexes ──────────────────────────────────────────────────────────────────

leadSchema.index({ email: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedExecutive: 1 });
leadSchema.index({ assignedManager: 1 });
leadSchema.index({ nextFollowUpDate: 1 });

// ✅ FIX 2: compound index for controller duplicate check
leadSchema.index({ phone: 1, source: 1 });

// ✅ FIX 4: prevent duplicate FB leads at DB level (sparse = only applies when field exists)
leadSchema.index({ fbLeadId: 1 }, { unique: true, sparse: true });

// ─── Pre-save hooks ───────────────────────────────────────────────────────────

leadSchema.pre('save', function (next) {
  this.updatedAt = new Date();

  // ✅ FIX 3: normalize phone on every save
  if (this.phone) {
    let digits = this.phone.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    this.phone = digits;
  }

  // Auto-calculate nextFollowUpDate from earliest pending follow-up
  if (this.followUps && this.followUps.length > 0) {
    const pending = this.followUps
      .filter(f => !f.completed)
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));

    this.nextFollowUpDate = pending.length > 0 ? pending[0].followUpAt : null;
  }

  next();
});

module.exports = mongoose.model('Lead', leadSchema);