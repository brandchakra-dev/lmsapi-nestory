const mongoose = require('mongoose');

// 🗓️ Follow-up subdocument schema - UPDATED with completion fields
const followUpSchema = new mongoose.Schema({
  followUpAt: {                 // 📅 Date + Time
    type: Date,
    required: true
  },

  nextFollowUpAt: {             // ⏭️ Optional next follow-up
    type: Date
  },

  note: {                       // 📝 Remark
    type: String,
    required: true,
    trim: true
  },

  createdBy: {                  // 👤 Who added it
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  createdAt: {                  // 🕒 Auto timestamp
    type: Date,
    default: Date.now
  },

  // ✅ NEW: Completion fields (required for complete button)
  completed: {
    type: Boolean,
    default: false
  },
  
  completedAt: {
    type: Date
  },
  
  completionNotes: {
    type: String,
    trim: true
  }
}, { _id: true }); // 👈 IMPORTANT: Har follow-up ka apna unique _id hoga

// 💬 Remark subdocument schema
const remarkSchema = new mongoose.Schema({
  remarkAt: {                   // 📅 Date + Time
    type: Date,
    required: true
  },

  text: {                       // 📝 Comment
    type: String,
    required: true,
    trim: true
  },

  createdBy: {                  // 👤 Who added it
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },

  createdAt: {                  // 🕒 Auto timestamp
    type: Date,
    default: Date.now
  }
}, { _id: true });

const statusHistorySchema = new mongoose.Schema({
  from: String,
  to: String,
  reason: String,
  changedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  date: { type: Date, default: Date.now }
});

const bookingSchema = new mongoose.Schema({
  bookingAmount: Number,
  bookingDate: Date,
  paymentMode: String,
  agreementNumber: String,
  possessionDate: Date,
  unitNumber: String,
  floorNumber: String,
  additionalNotes: String
});

// 🧩 Main Lead schema
const leadSchema = new mongoose.Schema({
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String },
  source: { type: String },
  details: { type: String },

  // 🏠 Project / property fields
  projectName: { type: String },
  projectCity: { type: String },
  budget: { type: String },
  typeOfResidence: { 
    type: String, 
    enum: ['1 BHK', '2 BHK', '3 BHK', '4 BHK', 'Villa', 'Penthouse', 'Plot', 'Other']
  },

  // 📊 Lead workflow
  status: { 
    type: String, 
    enum: ['new', 'visited', 'booked', 'active', 'inactive', 'closed', 'followup'], 
    default: 'new' 
  },
  inactiveReason: String,
  inactiveDate: Date,
  bookingDetails: bookingSchema,

  // 📅 Follow-ups and remarks
  followUps: [followUpSchema],  // 👈 Har follow-up ka apna _id hoga
  remarks: [remarkSchema],
  statusHistory: [statusHistorySchema],

  // 🧑‍💼 User relationships
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  assignedManager: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  assignedExecutive: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },

  assignedDate: { type: Date, default: Date.now },

  // 🕒 Metadata
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },

  // ✅ NEW: Next follow-up date for quick access
  nextFollowUpDate: {
    type: Date
  }
});

// Indexes for better performance
leadSchema.index({ email: 1 });
leadSchema.index({ phone: 1 });
leadSchema.index({ status: 1 });
leadSchema.index({ assignedExecutive: 1 });
leadSchema.index({ assignedManager: 1 });
leadSchema.index({ nextFollowUpDate: 1 });

// Auto-update timestamp and nextFollowUpDate on save
leadSchema.pre('save', function (next) {
  this.updatedAt = new Date();
  
  // Auto-calculate nextFollowUpDate from the latest pending follow-up
  if (this.followUps && this.followUps.length > 0) {
    // Get pending follow-ups (not completed)
    const pendingFollowUps = this.followUps
      .filter(f => !f.completed)
      .sort((a, b) => new Date(a.followUpAt) - new Date(b.followUpAt));
    
    this.nextFollowUpDate = pendingFollowUps.length > 0 
      ? pendingFollowUps[0].followUpAt 
      : null;
  }
  
  next();
});

module.exports = mongoose.model('Lead', leadSchema);