const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();

// ====== Create uploads folder if it does not exist ======
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// ====== CORS configuration ======
// Put your real frontend URL in FRONTEND_URL in Render env vars.
// Example: https://novus-yearbook.onrender.com
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
];

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin, like Postman or server-to-server
    // Also useful for some local testing setups
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`), false);
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// ====== Body parsing ======
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ====== Static uploads ======
app.use('/uploads', express.static(uploadsDir));

// ====== Multer configuration ======
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
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

// ====== Health check ======
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'API is running' });
});

// ====== Test endpoint ======
app.get('/api/test-db', async (req, res) => {
  try {
    const User = require('./models/User');
    const count = await User.countDocuments();
    res.json({ success: true, userCount: count });
  } catch (err) {
    console.error('Test DB error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ====== Routes ======
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/posts', require('./routes/posts'));

// ====== Error handler ======
app.use((err, req, res, next) => {
  console.error('Server error:', err);

  if (err.message && err.message.startsWith('CORS blocked')) {
    return res.status(403).json({ error: err.message });
  }

  if (err.message === 'Only image files are allowed') {
    return res.status(400).json({ error: err.message });
  }

  res.status(500).json({ error: err.message || 'Internal server error' });
});

// ====== MongoDB connection + start server ======
const PORT = process.env.PORT || 5000;

async function startServer() {
  try {
    console.log('🔄 Attempting to connect to MongoDB...');
    console.log('MONGO_URI exists:', !!process.env.MONGO_URI);

    await mongoose.connect(process.env.MONGO_URI);

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
      console.log('👑 Admin user already exists');
    }

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ MongoDB connection error:');
    console.error('Message:', err.message);
    process.exit(1);
  }
}

startServer();
