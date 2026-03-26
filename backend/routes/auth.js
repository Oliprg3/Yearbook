const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// -----------------------------
// REGISTER
// -----------------------------
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, year } = req.body;

    // ✅ Validate inputs
    if (!email || !password || !name || !year) {
      return res.status(400).json({ msg: 'Please provide all fields' });
    }
    if (password.length < 6) {
      return res.status(400).json({ msg: 'Password must be at least 6 characters' });
    }

    // ✅ Check if user exists
    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ msg: 'User already exists' });

    // ✅ Create new user
    user = new User({ email, password, name, year });
    await user.save();

    // ✅ Generate token
    const token = user.generateAuthToken();

    // ✅ Return response
    res.json({
      token,
      user: { id: user.id, name, email, year }
    });
  } catch (err) {
    console.error('Registration error:', err.message);
    res.status(500).json({ msg: 'Server error', details: err.message });
  }
});

// -----------------------------
// LOGIN
// -----------------------------
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // ✅ Validate inputs
    if (!email || !password) {
      return res.status(400).json({ msg: 'Please provide email and password' });
    }

    // ✅ Find user and include password for comparison
    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    // ✅ Compare password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    // ✅ Generate token
    const token = user.generateAuthToken();

    // ✅ Optional: update last login
    if (user.updateLastLogin) await user.updateLastLogin();

    // ✅ Return response
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, year: user.year }
    });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

// -----------------------------
// GET CURRENT USER
// -----------------------------
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) return res.status(404).json({ msg: 'User not found' });
    res.json(user);
  } catch (err) {
    console.error('Get me error:', err.message);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;