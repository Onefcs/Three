const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  telegramId: { type: String, required: true },
  firstName:  { type: String, default: '' },
  username:   { type: String, default: '' },
  platform:   { type: String, enum: ['youtube', 'tiktok', 'x'], required: true },
  link:       { type: String, required: true },
  status:     { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdAt:  { type: Date, default: Date.now },
});

module.exports = mongoose.model('SocialSubmission', schema);
