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
const PORT = process.env.PORT || 5000;

// Make sure uploads folder exists
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(cors({
    origin: ['https://novus-yearbook.onrender.com', 'http://localhost:3000'],
    credentials: true
}));

app.use(express.json());
app.use('/uploads', express.static(uploadsDir));

// Multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname).toLowerCase());
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

// Health check
app.get('/', (req, res) => {
    res.send('API is running');
});

// Start server after DB connection
async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected successfully');

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

        app.listen(PORT, () => {
            console.log(`🚀 Server running on port ${PORT}`);
        });
    } catch (err) {
        console.error('❌ Server failed to start:', err.message);
        process.exit(1);
    }
}

startServer();
