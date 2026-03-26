const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const Post = require('../models/Post');
const User = require('../models/User');
const auth = require('../middleware/auth');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    const unique = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'post-' + unique + path.extname(file.originalname));
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// Create post
router.post('/create', auth, upload.single('image'), async (req, res) => {
  try {
    const { content } = req.body;
    const user = await User.findById(req.user.id);
    if (!user) return res.status(404).json({ msg: 'User not found' });

    const newPost = new Post({
      author: user.id,
      authorName: user.name,
      authorAvatar: user.profileImage || '',
      content,
      image: req.file ? `/uploads/${req.file.filename}` : ''
    });
    await newPost.save();
    res.json(newPost);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get all posts
router.get('/', auth, async (req, res) => {
  try {
    const posts = await Post.find({ isDeleted: false })
      .sort({ createdAt: -1 })
      .populate('author', 'name profileImage')
      .lean();
    res.json(posts);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Like / unlike
router.post('/like/:postId', auth, async (req, res) => {
  try {
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });
    await post.toggleLike(req.user.id);
    res.json({ likes: post.likes });
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add comment
router.post('/comment/:postId', auth, async (req, res) => {
  try {
    const { text } = req.body;
    const user = await User.findById(req.user.id);
    const post = await Post.findById(req.params.postId);
    if (!post) return res.status(404).json({ msg: 'Post not found' });

    const comment = {
      user: user.id,
      userName: user.name,
      userAvatar: user.profileImage || '',
      text
    };
    await post.addComment(comment);
    res.json(post.comments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ msg: 'Server error' });
  }
});

module.exports = router;