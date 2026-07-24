const mongoose = require('mongoose');

const promoSchema = new mongoose.Schema({
  code:      { type: String, required: true, unique: true },
  value:     { type: Number, required: true, min: 0.01 },
  maxUses:   { type: Number, default: 0 },   // 0 = unlimited
  usedCount: { type: Number, default: 0 },
  usedBy:    { type: [String], default: [] }, // telegramIds
  expiresAt: { type: Date, default: null },
  isActive:  { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });

module.exports = mongoose.model('PromoCode', promoSchema);
