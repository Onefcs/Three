const mongoose = require('mongoose');

const schema = new mongoose.Schema({
  telegramId: { type: String, required: true, index: true },
  action:     { type: String, required: true },
  details:    { type: mongoose.Schema.Types.Mixed, default: {} },
  ip:         { type: String, default: '' },
  createdAt:  { type: Date, default: Date.now },
});

schema.index({ createdAt: -1 });
schema.index({ telegramId: 1, createdAt: -1 });

module.exports = mongoose.model('UserLog', schema);
