const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

// Get all users (students)
router.get('/all', async (req, res) => {
    try {
        const users = await User.find().select('-password');
        res.json(users);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get user by ID
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id).select('-password');
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        res.json(user);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Update user profile (admin only)
router.put('/update/:id', auth, async (req, res) => {
    try {
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
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Delete user (admin only)
router.delete('/deactivate/:id', auth, async (req, res) => {
    try {
        const requestingUser = await User.findById(req.user.id);
        if (!requestingUser.isAdmin) {
            return res.status(403).json({ msg: 'Not authorized' });
        }
        
        const user = await User.findByIdAndDelete(req.params.id);
        if (!user) {
            return res.status(404).json({ msg: 'User not found' });
        }
        
        res.json({ msg: 'User deleted successfully' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
