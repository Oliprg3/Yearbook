const mongoose = require('mongoose');

const UserSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    quote: { type: String, default: '' },
    dream: { type: String, default: '' },
    hobby: { type: String, default: '' },
    aspiration: { type: String, default: '' },
    funFact: { type: String, default: '' },
    profileImage: { type: String, default: null },
    year: { type: Number, default: 2027 },
    isAdmin: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('User', UserSchema);
