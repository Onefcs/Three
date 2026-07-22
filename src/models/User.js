const mongoose = require('mongoose');
const { GPU_CATALOG } = require('../config');

const gpuSlotSchema = new mongoose.Schema({
  gpuId:     { type: String, required: true },
  count:     { type: Number, default: 1, min: 1 },
}, { _id: false });

const userSchema = new mongoose.Schema({
  telegramId:  { type: String, required: true, unique: true, index: true },
  username:    { type: String, default: '' },
  firstName:   { type: String, default: '' },
  lastName:    { type: String, default: '' },
  photoUrl:    { type: String, default: '' },

  balance:         { type: Number, default: 0, min: 0 },
  lastCollectTime: { type: Date,   default: Date.now },

  // Owned GPUs
  gpus: { type: [gpuSlotSchema], default: () => [{ gpuId: 'rtx3060', count: 1 }] },

  // Referral system
  referredBy:      { type: String, default: null },   // telegramId of who invited this user
  referralPending: { type: Number, default: 0 },      // earned from referrals, not yet collected
  referralEarned:  { type: Number, default: 0 },      // lifetime total from referrals

  createdAt:  { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now },
}, { versionKey: false });

// Virtual: list of users who were referred by this user
userSchema.virtual('referralCount', {
  ref: 'User',
  localField: 'telegramId',
  foreignField: 'referredBy',
  count: true,
});

// Calculate income per second from current GPU loadout
userSchema.methods.calcPerSec = function () {
  return this.gpus.reduce((sum, slot) => {
    const gpu = GPU_CATALOG[slot.gpuId];
    if (!gpu) return sum;
    return sum + (gpu.incomePerHour * slot.count) / 3600;
  }, 0);
};

// Calculate pending mining income since last collect
userSchema.methods.calcPending = function () {
  const secondsElapsed = (Date.now() - this.lastCollectTime.getTime()) / 1000;
  return this.calcPerSec() * secondsElapsed;
};

// Price for the next purchase of a given gpuId
userSchema.methods.nextPrice = function (gpuId) {
  const gpu = GPU_CATALOG[gpuId];
  if (!gpu) return null;
  const slot = this.gpus.find(s => s.gpuId === gpuId);
  const owned = slot ? slot.count : 0;
  return Math.round(gpu.basePrice * Math.pow(1.1, owned));
};

const User = mongoose.model('User', userSchema);
module.exports = User;
