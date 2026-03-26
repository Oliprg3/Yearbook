const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');          // <-- added

dotenv.config();

const app = express();

// CORS configuration
app.use(cors({
    origin: ['https://novus-yearbook.onrender.com', 'http://localhost:3000'],
    credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Multer configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, path.join(__dirname, 'uploads'));
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
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

app.locals.upload = upload;

// Test endpoint (optional)
app.get('/api/test-db', async (req, res) => {
    try {
        const User = require('./models/User');
        const count = await User.countDocuments();
        res.json({ success: true, userCount: count });
    } catch (err) {
        console.error('Test DB error:', err);
        res.status(500).json({ error: err.message, stack: err.stack });
    }
});

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/posts', require('./routes/posts'));

// ========== MONGODB CONNECTION + ADMIN CREATION ==========
console.log('🔄 Attempting to connect to MongoDB...');
console.log('MONGO_URI exists:', !!process.env.MONGO_URI);

mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
      console.log('✅ MongoDB connected successfully');

      // Create admin user if not exists
      const User = require('./models/User');
      const adminExists = await User.findOne({ email: 'admin@newayacademy.com' });

      if (!adminExists) {
          const hashedPassword = await bcrypt.hash('admin123', 10);
          await User.create({
              name: 'Administrator',
              email: 'admin@newayacademy.com',
              password: hashedPassword,
              isAdmin: true,
              year: 2027
          });
          console.log('✅ Admin user created with email: admin@newayacademy.com');
      } else {
          // Optional: if admin exists but password hash might be wrong, you could update it here.
          // For simplicity, we'll keep existing. If login still fails, delete the old admin document and let this recreate it.
          console.log('👑 Admin user already exists');
      }
  })
  .catch(err => {
      console.error('❌ MongoDB connection error:');
      console.error('  Message:', err.message);
      console.error('  Full error:', err);
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
