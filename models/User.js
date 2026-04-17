const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: [true, 'Name is required'],
    trim: true,
    maxlength: [50, 'Name cannot exceed 50 characters']
  },
  
  email: { 
    type: String, 
    required: [true, 'Email is required'], 
    unique: true, 
    lowercase: true,
    match: [/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/, 'Please enter a valid email']
  },
  
  password: { 
    type: String, 
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters']
  },

  phone: {
    type: String,
    trim: true,
    validate: {
      validator: function(v) {
        return !v || /^\d{10}$/.test(v); // Allow empty or 10 digits
      },
      message: 'Please enter a valid 10-digit phone number'
    }
  },

  role: { 
    type: String, 
    enum: ['superadmin', 'admin', 'manager', 'executive'], 
    default: 'executive' 
  },

  permissions: {
    type: [String],
    default: []
  },

  assignedManager: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null,
  },
  
  assignedProjects: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Project"
    }
  ],  

  isActive: {
    type: Boolean,
    default: true
  },

  lastLogin: {
    type: Date
  },

  createdAt: { 
    type: Date, 
    default: Date.now 
  },

  updatedAt: { 
    type: Date, 
    default: Date.now 
 
  },

  loginAttempts: { type: Number, default: 0 },
  lockUntil: { type: Date },

  refreshToken: {
    type: String,
    default: null
  },

  pushToken: {
    type: String,
    default: null
  }
  
});

// Update timestamp on save
userSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Hash password before saving
userSchema.pre('save', async function(next){
  if(!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.matchPassword = async function(enteredPassword){
  return await bcrypt.compare(enteredPassword, this.password);
}

// Method to get user without sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
}

module.exports = mongoose.model('User', userSchema);