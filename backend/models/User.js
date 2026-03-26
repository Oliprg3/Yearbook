const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const UserSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  year: {
    type: Number,
    required: true
  },
  quote: { type: String, default: '' },
  favoriteMemory: { type: String, default: '' },
  aspiration: { type: String, default: '' },
  funFact: { type: String, default: '' },
  superpower: { type: String, default: '' },
  profileImage: { type: String, default: '' },
  colorTheme: { type: String, default: '#3b82f6' },
  isActive: { type: Boolean, default: true },
  lastLogin: { type: Date, default: null }
}, { timestamps: true });

// Hash password before saving
UserSchema.pre('save', async function () {
  if (!this.isModified('password')) return;
  this.password = await bcrypt.hash(this.password, 10);
});

// Compare password
UserSchema.methods.comparePassword = async function(candidate) {
  return bcrypt.compare(candidate, this.password);
};

// Generate JWT
UserSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    { user: { id: this._id } },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
};

// Update last login
UserSchema.methods.updateLastLogin = async function() {
  this.lastLogin = new Date();
  await this.save();
};

module.exports = mongoose.model('User', UserSchema);