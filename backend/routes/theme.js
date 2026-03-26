const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// Update theme
router.put('/', auth, async (req, res) => {
  try {
    const { color } = req.body;
    const user = await User.findById(req.user.id);
    user.colorTheme = color;
    await user.save();
    res.json({ colorTheme: user.colorTheme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get theme
router.get('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('colorTheme');
    res.json({ colorTheme: user.colorTheme });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;