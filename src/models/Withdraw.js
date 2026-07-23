const mongoose = require('mongoose');

const withdrawSchema = new mongoose.Schema({
  telegramId:    { type: String, required: true, index: true },
  username:      { type: String, default: '' },
  firstName:     { type: String, default: '' },
  coreAmount:    { type: Number, required: true },
  walletAddress: { type: String, required: true },
  status:        { type: String, enum: ['pending', 'confirmed', 'rejected'], default: 'pending' },
  adminMessageId:{ type: Number, default: null },
  createdAt:     { type: Date, default: Date.now },
});

module.exports = mongoose.model('Withdraw', withdrawSchema);
