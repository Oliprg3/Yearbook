const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// @route   GET /api/profile/all
// @desc    Get all users (students)
// @access  Public (any logged in user can see)
router.get('/all', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   GET /api/profile/:id
// @desc    Get user by ID
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   PUT /api/profile/update/:id
// @desc    Update user profile (admin only)
// @access  Admin
router.put('/update/:id', auth, async (req, res) => {
    try {
        // Check if requester is admin OR has the hardcoded admin email
        const requester = await User.findById(req.user.id);
        if (!requester.isAdmin && requester.email !== 'adminof11g@gmail.com') {
            return res.status(403).json({ error: 'Only admin can update students' });
        }

        const { name, quote, dream, hobby, aspiration, funFact, profileImage } = req.body;
        
        const updateFields = {};
        if (name) updateFields.name = name;
        if (quote !== undefined) updateFields.quote = quote;
        if (dream !== undefined) updateFields.dream = dream;
        if (hobby !== undefined) updateFields.hobby = hobby;
        if (aspiration !== undefined) updateFields.aspiration = aspiration;
        if (funFact !== undefined) updateFields.funFact = funFact;
        if (profileImage) updateFields.profileImage = profileImage;
        
        const user = await User.findByIdAndUpdate(
            req.params.id,
            { $set: updateFields },
            { new: true }
        ).select('-password');
        
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   DELETE /api/profile/deactivate/:id
// @desc    Delete user (admin only)
// @access  Admin
router.delete('/deactivate/:id', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id);
        if (!requester.isAdmin && requester.email !== 'adminof11g@gmail.com') {
            return res.status(403).json({ error: 'Only admin can delete students' });
        }
        
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
