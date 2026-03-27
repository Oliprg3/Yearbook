const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

// @route   POST /api/posts/create
// @desc    Create a new memory post (admin only)
// @access  Admin
router.post('/create', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Only admin can create memories' });
        }

        const { content } = req.body;
        // Multer attaches file to req.file, but for simplicity we'll read from req.body.image (base64) if file not present.
        let image = null;
        if (req.file) {
            image = `/uploads/${req.file.filename}`;
        } else if (req.body.image) {
            image = req.body.image;
        }
        
        const post = new Post({
            content,
            image,
            author: req.user.id
        });
        
        await post.save();
        res.json(post);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   GET /api/posts
// @desc    Get all posts (memories)
// @access  Public
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   GET /api/posts/:id
// @desc    Get a single post
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        res.json(post);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

// @route   DELETE /api/posts/:id
// @desc    Delete a post (admin only)
// @access  Admin
router.delete('/:id', auth, async (req, res) => {
    try {
        const requester = await User.findById(req.user.id);
        if (!requester.isAdmin) {
            return res.status(403).json({ error: 'Only admin can delete memories' });
        }
        
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        
        await post.deleteOne();
        res.json({ msg: 'Post deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
