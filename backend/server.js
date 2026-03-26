const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const multer = require('multer');
const bcrypt = require('bcryptjs');

dotenv.config();

const app = express();

// CORS configuration – add your frontend domain
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

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/profile', require('./routes/profile'));
app.use('/api/posts', require('./routes/posts'));

// MongoDB connection with admin creation
mongoose.connect(process.env.MONGO_URI)
  .then(async () => {
      console.log('✅ MongoDB connected successfully');

      // Auto-create admin user if not exists
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
          console.log('✅ Admin user created (email: admin@newayacademy.com, password: admin123)');
      } else {
          console.log('👑 Admin user already exists');
      }
  })
  .catch(err => {
      console.error('❌ MongoDB connection error:', err);
      // Do not exit – let the server run even if DB fails (it will return errors)
  });

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
