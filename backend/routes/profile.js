const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Helper: check if user is admin
const isAdmin = (user) => user.email === 'admin@newayacademy.com';

// ==================== PUBLIC ENDPOINTS ====================
// Get all active users (for yearbook)
router.get('/all', auth, async (req, res) => {
  try {
    const users = await User.find({ isActive: true }).select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all users (including inactive) – only for admin
router.get('/all/admin', auth, async (req, res) => {
  try {
    if (!isAdmin(req.user.full)) return res.status(403).json({ msg: 'Not authorized' });
    const users = await User.find().select('-password');
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==================== PROFILE UPDATE (self or admin) ====================
router.put('/update', auth, async (req, res) => {
  try {
    let userId = req.user.id;
    let user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // If admin is updating someone else, allow (we'll use a separate route to avoid confusion)
    // For simplicity, we keep self-update here, and admin updates via /update/:id
    const { name, year, quote, favoriteMemory, aspiration, funFact, superpower } = req.body;

    if (name) user.name = name;
    if (year) user.year = year;
    if (quote !== undefined) user.quote = quote;
    if (favoriteMemory !== undefined) user.favoriteMemory = favoriteMemory;
    if (aspiration !== undefined) user.aspiration = aspiration;
    if (funFact !== undefined) user.funFact = funFact;
    if (superpower !== undefined) user.superpower = superpower;

    await user.save();
    res.json({ msg: 'Profile updated', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin update any user
router.put('/update/:id', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!isAdmin(adminUser)) return res.status(403).json({ msg: 'Not authorized' });

    const userId = req.params.id;
    const { name, year, quote, favoriteMemory, aspiration, funFact, superpower, profileImage } = req.body;
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    if (name !== undefined) user.name = name;
    if (year !== undefined) user.year = year;
    if (quote !== undefined) user.quote = quote;
    if (favoriteMemory !== undefined) user.favoriteMemory = favoriteMemory;
    if (aspiration !== undefined) user.aspiration = aspiration;
    if (funFact !== undefined) user.funFact = funFact;
    if (superpower !== undefined) user.superpower = superpower;
    if (profileImage !== undefined) user.profileImage = profileImage;

    await user.save();
    res.json({ msg: 'Profile updated by admin', user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==================== UPLOAD PROFILE PICTURE (self or admin) ====================
router.post('/upload', auth, upload.single('profileImage'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const user = await User.findById(req.user.id);
    user.profileImage = `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ imageUrl: user.profileImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin upload for any user
router.post('/upload/:id', auth, upload.single('profileImage'), async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!isAdmin(adminUser)) return res.status(403).json({ msg: 'Not authorized' });

    if (!req.file) return res.status(400).json({ msg: 'No file uploaded' });
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });
    user.profileImage = `/uploads/${req.file.filename}`;
    await user.save();
    res.json({ imageUrl: user.profileImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// ==================== DELETE / DEACTIVATE USER (admin only) ====================
router.delete('/deactivate/:id', auth, async (req, res) => {
  try {
    const adminUser = await User.findById(req.user.id);
    if (!isAdmin(adminUser)) return res.status(403).json({ msg: 'Not authorized' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    // Soft delete (set isActive = false)
    user.isActive = false;
    await user.save();
    res.json({ msg: 'User deactivated successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// (Optional) Hard delete (remove from DB) – uncomment if needed
// router.delete('/:id', auth, async (req, res) => { ... });

module.exports = router;