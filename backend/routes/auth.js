const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const User = require('../models/User');
const auth = require('../middleware/auth');

// Configure multer for profile image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, '../uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        if (mimetype && extname) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed'));
        }
    }
});

// @route   POST /api/auth/register
// @desc    Create a new student (admin only)
// @access  Admin
router.post('/register', auth, upload.single('profileImage'), async (req, res) => {
    try {
        // Check if requester is admin
        const requester = await User.findById(req.user.id);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Only admin can create students' });
        }

        // Fields from multipart form
        const { name, email, password, quote, dream, hobby, aspiration, funFact, year } = req.body;
        
        // Check if user already exists
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ error: 'User already exists' });
        }
        
        // Create new user
        user = new User({
            name,
            email,
            password,
            quote: quote || '',
            dream: dream || '',
            hobby: hobby || '',
            aspiration: aspiration || '',
            funFact: funFact || '',
            year: year || 2027,
            isAdmin: false,
            profileImage: req.file ? `/uploads/${req.file.filename}` : null
        });
        
        // Hash password
        const salt = await bcrypt.genSalt(10);
        user.password = await bcrypt.hash(password, salt);
        
        await user.save();
        
        res.json({ message: 'Student created successfully', user: { id: user.id, name, email } });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   POST /api/auth/login
// @desc    Authenticate user & get token
// @access  Public
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ error: 'Invalid credentials' });
        }
        
        const payload = {
            user: {
                id: user.id,
                email: user.email,
                isAdmin: user.isAdmin
            }
        };
        
        jwt.sign(
            payload,
            process.env.JWT_SECRET,
            { expiresIn: '7d' },
            (err, token) => {
                if (err) throw err;
                res.json({ token, user: { id: user.id, name: user.name, email, isAdmin: user.isAdmin } });
            }
        );
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   GET /api/auth/me
// @desc    Get current user
// @access  Private
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
