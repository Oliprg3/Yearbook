const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Change this to your real backend base URL
const BASE_URL = process.env.SERVER_URL || 'http://localhost:5000';

// Helper function to upload buffer to Cloudinary
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

// Email transporter
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

// Send verification email
const sendVerificationEmail = async (email, token) => {
    const verifyUrl = `${BASE_URL}/api/auth/verify/${token}`;

    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Verify your email',
        html: `
            <div style="font-family: Arial, sans-serif; line-height: 1.6">
                <h2>Verify your email</h2>
                <p>Click the link below to verify your account:</p>
                <p><a href="${verifyUrl}">${verifyUrl}</a></p>
                <p>If you did not create this account, you can ignore this email.</p>
            </div>
        `
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

        const cleanEmail = email.trim().toLowerCase();

        let user = await User.findOne({ email: cleanEmail });
        if (user) return res.status(400).json({ error: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationToken = crypto.randomBytes(32).toString('hex');

        user = new User({
            name,
            email: cleanEmail,
            password: hashedPassword,
            year: year || 2027,
            isAdmin: false,
            isStudent: false,
            isVerified: false,
            verificationToken
        });

        await user.save();

        await sendVerificationEmail(user.email, verificationToken);

        res.json({
            message: 'Account created. Check your email to verify your account.'
        });
    } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Server error' });
    }
});

// ========== VERIFY EMAIL ==========
router.get('/verify/:token', async (req, res) => {
    try {
        const user = await User.findOne({ verificationToken: req.params.token });

        if (!user) {
            return res.status(400).json({ error: 'Invalid or expired verification token' });
        }

        user.isVerified = true;
        user.verificationToken = null;
        await user.save();

        res.json({ message: 'Email verified successfully' });
    } catch (err) {
        console.error('Verify error:', err);
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

        const cleanEmail = email.trim().toLowerCase();

        const user = await User.findOne({ email: cleanEmail });
        if (!user) return res.status(401).json({ error: 'Invalid credentials' });

        if (user.isVerified === false) {
            return res.status(403).json({ error: 'Please verify your email first' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(401).json({ error: 'Invalid credentials' });

        const payload = { user: { id: user.id, email: user.email, isAdmin: user.isAdmin } };
        const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

        res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
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
        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }
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
            if (!requester || !requester.isAdmin) {
                return res.status(403).json({ error: 'Only admin can create students' });
            }

            const { name, email, password, quote, dream, hobby, aspiration, funFact, year } = req.body;
            if (!name || !email || !password) {
                return res.status(400).json({ error: 'Name, email, and password required' });
            }

            const cleanEmail = email.trim().toLowerCase();

            let existing = await User.findOne({ email: cleanEmail });
            if (existing) return res.status(400).json({ error: 'User already exists' });

            let profileImageUrl = null;
            if (req.file) {
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'novus-yearbook/profiles'
                });
                profileImageUrl = result.secure_url;
                console.log('✅ Image uploaded to Cloudinary:', profileImageUrl);
            }

            const hashedPassword = await bcrypt.hash(password, 10);
            const verificationToken = crypto.randomBytes(32).toString('hex');

            const newStudent = new User({
                name,
                email: cleanEmail,
                password: hashedPassword,
                quote: quote || '',
                dream: dream || '',
                hobby: hobby || '',
                aspiration: aspiration || '',
                funFact: funFact || '',
                year: year || 2027,
                isAdmin: false,
                isStudent: true,
                isVerified: false,
                verificationToken,
                profileImage: profileImageUrl
            });

            await newStudent.save();

            await sendVerificationEmail(newStudent.email, verificationToken);

            res.json({
                message: 'Student created successfully. Verification email sent.',
                user: { id: newStudent.id, name, email: newStudent.email, profileImage: newStudent.profileImage }
            });
        } catch (err) {
            console.error('Admin create student error:', err);
            res.status(500).json({ error: 'Server error', details: err.message });
        }
    });
});

module.exports = router;
