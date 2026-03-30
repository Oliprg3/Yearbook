const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const admin = require('firebase-admin');   // <-- new import

// Initialize Firebase Admin SDK (only once)
if (!admin.apps.length) {
  // Adjust the path to where your serviceAccountKey.json is located
  // If it's in the root of your project, use './serviceAccountKey.json'
  const serviceAccount = require('../serviceAccountKey.json'); 
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

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
      isStudent: false,
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
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// ========== GOOGLE SIGN-IN ==========
router.post('/google', async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) {
      return res.status(400).json({ error: 'Missing idToken' });
    }

    // Verify the ID token
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { email, name, picture } = decodedToken;

    if (!email) {
      return res.status(400).json({ error: 'No email provided by Google' });
    }

    // Find or create user
    let user = await User.findOne({ email });
    if (!user) {
      // Create a new user (viewer by default, not a student)
      const randomPassword = require('crypto').randomBytes(20).toString('hex');
      const hashedPassword = await bcrypt.hash(randomPassword, 10);

      user = new User({
        name: name || email.split('@')[0],
        email,
        password: hashedPassword,
        profileImage: picture || '',
        isAdmin: false,
        isStudent: false,
        year: 2027,
      });
      await user.save();
    }

    // Generate JWT (same as login)
    const payload = { user: { id: user.id, email: user.email, isAdmin: user.isAdmin } };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        isAdmin: user.isAdmin,
        profileImage: user.profileImage,
      },
    });
  } catch (err) {
    console.error('Google auth error:', err);
    res.status(401).json({ error: 'Invalid Google token' });
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
router.post('/register', auth, (req, res, next) => {
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
        const result = await uploadToCloudinary(req.file.buffer, {
          folder: 'novus-yearbook/profiles',
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
        isStudent: true,
        profileImage: profileImageUrl,
      });

      await newStudent.save();

      res.json({
        message: 'Student created successfully',
        user: { id: newStudent.id, name, email, profileImage: newStudent.profileImage },
      });
    } catch (err) {
      console.error('Admin create student error:', err);
      res.status(500).json({ error: 'Server error', details: err.message });
    }
  });
});

module.exports = router;
