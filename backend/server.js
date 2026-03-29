const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const bcrypt = require("bcryptjs");
const cloudinary = require("cloudinary").v2;

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

/* ---------------- CLOUDINARY CONFIG ---------------- */
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log("Cloudinary configured");

/* ---------------- UPLOADS FOLDER ---------------- */
const uploadsDir = path.join(__dirname, "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

/* ---------------- MIDDLEWARE ---------------- */
app.use(
  cors({
    origin: ["https://novus-yearbook.onrender.com", "http://localhost:3000"],
    credentials: true,
  })
);

app.use(express.json());
app.use("/uploads", express.static(uploadsDir));

/* ---------------- MULTER ---------------- */
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif/;

    const extOk = allowed.test(path.extname(file.originalname).toLowerCase());
    const mimeOk = allowed.test(file.mimetype);

    if (extOk && mimeOk) cb(null, true);
    else cb(new Error("Only image files are allowed"));
  },
});

/* make available in routes */
app.locals.upload = upload;
app.locals.cloudinary = cloudinary;

/* ---------------- ROUTES ---------------- */
app.use("/api/auth", require("./routes/auth"));
app.use("/api/profile", require("./routes/profile"));
app.use("/api/posts", require("./routes/posts"));

/* ---------------- HEALTH CHECK ---------------- */
app.get("/", (req, res) => {
  res.json({ status: "API running" });
});

/* ---------------- START SERVER ---------------- */
async function startServer() {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected");

    const User = require("./models/User");

    const adminEmail = "admin@newayacademy.com";

    const adminExists = await User.findOne({ email: adminEmail });

    if (!adminExists) {
      const hashedPassword = await bcrypt.hash("admin123", 10);

      await User.create({
        name: "Administrator",
        email: adminEmail,
        password: hashedPassword,
        isAdmin: true,
        year: 2027,
      });

      console.log("Admin created");
    } else {
      console.log("Admin already exists");
    }

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (err) {
    console.error("Server failed:", err.message);
    process.exit(1);
  }
}

startServer();
