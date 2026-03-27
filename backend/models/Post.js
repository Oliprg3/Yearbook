const mongoose = require('mongoose');

const PostSchema = new mongoose.Schema({
    content: { type: String, required: true },
    image: { type: String, default: null },
    author: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

module.exports = mongoose.model('Post', PostSchema);
