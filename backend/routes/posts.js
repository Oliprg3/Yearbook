const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

// Create a new memory post (admin only)
router.post('/create', auth, async (req, res) => {
    try {
        // For admin-only, we check if user is admin
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Only admin can create memories' });
        }

        const { content } = req.body;
        // If image is sent, it will be handled by multer, but we'll keep simple for now
        // In your frontend, you send FormData with image, so we need multer middleware.
        // We'll add multer handling in server.js and use app.locals.upload here.
        // For simplicity, we'll assume image is sent as a base64 string or via file upload.
        // We'll adapt: if req.file exists, use it; else use provided image string.
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
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get all posts (memories)
router.get('/', async (req, res) => {
    try {
        const posts = await Post.find().sort({ createdAt: -1 });
        res.json(posts);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Get a single post
router.get('/:id', async (req, res) => {
    try {
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        res.json(post);
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Delete a post (admin only)
router.delete('/:id', auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (!user.isAdmin) {
            return res.status(403).json({ msg: 'Only admin can delete memories' });
        }
        
        const post = await Post.findById(req.params.id);
        if (!post) {
            return res.status(404).json({ msg: 'Post not found' });
        }
        
        await post.deleteOne();
        res.json({ msg: 'Post deleted' });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

module.exports = router;
