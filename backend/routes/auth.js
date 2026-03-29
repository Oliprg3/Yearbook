const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

const uploadToCloudinary = (buffer, options) => {
    return new Promise((resolve, reject) => {
        const cloudinary = require('cloudinary').v2;
        const uploadStream = cloudinary.uploader.upload_stream(options, (error, result) => {
            if (error) return reject(error);
            resolve(result);
        });
        uploadStream.end(buffer);
    });
};

// ========== PUBLIC SIGNUP (regular viewers) ==========
// They get isStudent: false by default
router.post('/signup', async (req, res) => {
    try {
        const { name, email, password, year } = req.body;
        if (!name || !email || !password) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        user = new User({
            name,
            email,
            password: hashedPassword,
            year: year || 2027,
            isAdmin: false,
            isStudent: false, // not added to student list
        });
        await user.save();

        const payload = { user: { id: user.id, email: user.email, isAdmin: user.isAdmin } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ token, user: { id: user.id, name: user.name, email, isAdmin: user.isAdmin } });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== LOGIN ==========
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: 'Invalid credentials' });

        const payload = { user: { id: user.id, email: user.email, isAdmin: user.isAdmin } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({ 
            token, 
            user: { 
                id: user.id, 
                name: user.name, 
                email, 
                isAdmin: user.isAdmin,
                profileImage: user.profileImage 
            } 
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== GET CURRENT USER ==========
router.get('/me', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select('-password');
        res.json(user);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== ADMIN-ONLY: CREATE STUDENT (with photo) ==========
// This route uses Cloudinary for permanent image storage
router.post('/register', auth, (req, res, next) => {
    // Use the upload instance attached to the app (configured in server.js)
    req.app.locals.upload.single('profileImage')(req, res, async (err) => {
        if (err) return res.status(400).json({ error: err.message });

        try {
            const requester = await User.findById(req.user.id);
            if (!requester.isAdmin) {
                return res.status(403).json({ error: 'Only admin can create students' });
            }

            const { name, email, password, quote, dream, hobby, aspiration, funFact, year } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ error: 'Name, email, and password required' });
            }

            let existing = await User.findOne({ email });
            if (existing) return res.status(400).json({ error: 'User already exists' });

            let profileImageUrl = null;
            if (req.file) {
                // Upload to Cloudinary instead of saving locally
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'novus-yearbook/profiles'
                });
                profileImageUrl = result.secure_url;
                console.log('✅ Image uploaded to Cloudinary:', profileImageUrl);
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const newStudent = new User({
                name,
                email,
                password: hashedPassword,
                quote: quote || '',
                dream: dream || '',
                hobby: hobby || '',
                aspiration: aspiration || '',
                funFact: funFact || '',
                year: year || 2027,
                isAdmin: false,
                isStudent: true,          // <-- mark as a student (appears in student list)
                profileImage: profileImageUrl  // Cloudinary URL instead of local path
            });

            await newStudent.save();

            res.json({
                message: 'Student created successfully',
                user: { id: newStudent.id, name, email, profileImage: newStudent.profileImage }
            });
        } catch (err) {
            console.error('Admin create student error:', err);
            res.status(500).json({ error: 'Server error', details: err.message });
        }
    });
});

module.exports = router;
