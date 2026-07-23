const mongoose = require('mongoose');

const depositSchema = new mongoose.Schema({
  telegramId:     { type: String, required: true, index: true },
  username:       { type: String, default: '' },
  firstName:      { type: String, default: '' },
  coreAmount:     { type: Number, required: true },
  tonAmount:      { type: Number, default: 0 },
  memo:           { type: String, default: '' },
  status:         { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  adminMessageId: { type: Number, default: null },
  createdAt:      { type: Date, default: Date.now },
});

module.exports = mongoose.model('Deposit', depositSchema);
