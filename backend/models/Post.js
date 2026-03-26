const mongoose = require('mongoose');

const CommentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  userName: { type: String, required: true },
  userAvatar: { type: String, default: '' },
  text: { type: String, required: true, trim: true },
  createdAt: { type: Date, default: Date.now }
});

const PostSchema = new mongoose.Schema({
  author: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  authorName: { type: String, required: true },
  authorAvatar: { type: String, default: '' },
  content: { type: String, required: true, trim: true },
  image: { type: String, default: '' },
  likes: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', default: [] }],
  comments: [CommentSchema],
  isDeleted: { type: Boolean, default: false }
}, { timestamps: true });

// Virtuals
PostSchema.virtual('likeCount').get(function() { return this.likes.length; });
PostSchema.virtual('commentCount').get(function() { return this.comments.length; });

// Instance methods
PostSchema.methods.toggleLike = async function(userId) {
  const idx = this.likes.indexOf(userId);
  if (idx === -1) this.likes.push(userId);
  else this.likes.splice(idx, 1);
  await this.save();
  return this.likes;
};

PostSchema.methods.addComment = async function(commentData) {
  this.comments.push(commentData);
  await this.save();
  return this.comments;
};

// Static method to get paginated posts
PostSchema.statics.getFeed = async function({ page = 1, limit = 10 }) {
  const skip = (page - 1) * limit;
  const posts = await this.find({ isDeleted: false })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('author', 'name profileImage')
    .lean();
  const total = await this.countDocuments({ isDeleted: false });
  return { posts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
};

module.exports = mongoose.model('Post', PostSchema);