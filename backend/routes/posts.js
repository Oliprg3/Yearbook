const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const Post = require('../models/Post');
const User = require('../models/User');

// Helper function to upload buffer to Cloudinar
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

// @route   POST /api/posts/create
// @desc    Create a new memory post (admin only)
// @access  Admin
router.post('/create', auth, (req, res, next) => {
    // Use the multer instance from server.js to handle file upload
    req.app.locals.upload.single('image')(req, res, async (err) => {
        if (err) {
            return res.status(400).json({ error: err.message });
        }

        try {
            const requester = await User.findById(req.user.id);
            if (!requester.isAdmin) {
                return res.status(403).json({ error: 'Only admin can create memories' });
            }

            const { content } = req.body;
            if (!content) {
                return res.status(400).json({ error: 'Content is required' });
            }

            let imageUrl = null;
            if (req.file) {
                // Upload to Cloudinary instead of saving locally
                const result = await uploadToCloudinary(req.file.buffer, {
                    folder: 'novus-yearbook/memories'
                });
                imageUrl = result.secure_url;
                console.log('✅ Memory image uploaded to Cloudinary:', imageUrl);
            } else if (req.body.image) {
                imageUrl = req.body.image;
            }

            const post = new Post({
                content,
                image: imageUrl,
                author: req.user.id
            });

            await post.save();
            res.json(post);
        } catch (err) {
            console.error('Create post error:', err);
            res.status(500).json({ error: 'Server error', details: err.message });
        }
    });
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
            return res.status(404).json({ error: 'Post not found' });
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
            return res.status(404).json({ error: 'Post not found' });
        }

        // Optional: Delete image from Cloudinary if it exists
        // This would free up storage space
        if (post.image && post.image.includes('cloudinary.com')) {
            try {
                // Extract public ID from Cloudinary URL
                // URL format: https://res.cloudinary.com/cloud_name/image/upload/v1234567890/folder/filename.jpg
                const urlParts = post.image.split('/');
                const filename = urlParts[urlParts.length - 1].split('.')[0];
                const folder = 'novus-yearbook/memories';
                const publicId = `${folder}/${filename}`;
                
                const cloudinary = require('cloudinary').v2;
                await cloudinary.uploader.destroy(publicId);
                console.log('✅ Deleted image from Cloudinary:', publicId);
            } catch (cloudinaryErr) {
                console.error('Failed to delete from Cloudinary:', cloudinaryErr);
                // Don't fail the request if Cloudinary deletion fails
            }
        }

        await post.deleteOne();
        res.json({ message: 'Post deleted successfully' });
    } catch (err) {
        console.error('Delete post error:', err);
        res.status(500).json({ error: 'Server error', details: err.message });
    }
});

module.exports = router;
