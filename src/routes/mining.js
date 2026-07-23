const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');
const { GPU_CATALOG, REFERRAL_PERCENT, COLLECT_COOLDOWN_MS } = require('../config');

// POST /api/collect  — collect pending mining income (atomic, race-safe)
router.post('/collect', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const earned = user.calcPending();
    if (earned < 0.001) return res.json({ collected: 0, balance: user.balance });

    const now = new Date();
    // Cutoff: lastCollectTime must be old enough (enforces cooldown between collects).
    // Using $lte instead of exact match prevents simultaneous double-collect from two devices:
    // once the first request wins and sets lastCollectTime=now, the second request's condition
    // { lastCollectTime: { $lte: cutoff } } fails because now > cutoff.
    const cutoff = new Date(now.getTime() - COLLECT_COOLDOWN_MS);

    const updated = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId, lastCollectTime: { $lte: cutoff } },
      { $inc: { balance: earned }, $set: { lastCollectTime: now, lastActive: now } },
      { new: true }
    );

    if (!updated) {
      // Either on cooldown or race lost — return fresh state with next allowed collect time
      const fresh = await User.findOne({ telegramId: req.user.telegramId });
      const nextCollectAt = new Date(fresh.lastCollectTime.getTime() + COLLECT_COOLDOWN_MS);
      return res.json({ collected: 0, balance: fresh.balance, nextCollectAt, lastCollectTime: fresh.lastCollectTime });
    }

    // Credit referrer 5%
    if (user.referredBy) {
      const bonus = earned * (REFERRAL_PERCENT / 100);
      await User.updateOne(
        { telegramId: user.referredBy },
        { $inc: { referralPending: bonus, referralEarned: bonus } }
      );
    }

    const nextCollectAt = new Date(now.getTime() + COLLECT_COOLDOWN_MS);
    res.json({ collected: earned, balance: updated.balance, nextCollectAt });
  } catch (err) {
    console.error('collect error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/buy-gpu  — purchase one unit of a GPU
// Body: { gpuId: string }
router.post('/buy-gpu', requireAuth, async (req, res) => {
  try {
    const { gpuId } = req.body;
    if (!gpuId || !GPU_CATALOG[gpuId]) {
      return res.status(400).json({ error: 'Unknown gpuId' });
    }

    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Atomically collect pending income before purchase
    const earned = user.calcPending();
    const now = new Date();
    if (earned > 0) {
      const collected = await User.findOneAndUpdate(
        { telegramId: req.user.telegramId, lastCollectTime: user.lastCollectTime },
        { $inc: { balance: earned }, $set: { lastCollectTime: now, lastActive: now } },
        { new: true }
      );
      if (collected) {
        user.balance = collected.balance;
        user.lastCollectTime = now;
        if (user.referredBy) {
          const bonus = earned * (REFERRAL_PERCENT / 100);
          await User.updateOne(
            { telegramId: user.referredBy },
            { $inc: { referralPending: bonus, referralEarned: bonus } }
          );
        }
      }
    }

    const price = user.nextPrice(gpuId);
    if (user.balance < price) {
      return res.status(400).json({ error: 'Insufficient balance', price, balance: user.balance });
    }

    user.balance -= price;
    const slot = user.gpus.find(s => s.gpuId === gpuId);
    if (slot) {
      slot.count += 1;
    } else {
      user.gpus.push({ gpuId, count: 1 });
    }

    await user.save();
    res.json({ gpus: user.gpus, balance: user.balance, boughtGpuId: gpuId });
  } catch (err) {
    console.error('buy-gpu error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/status  — get current balance + pending income
router.get('/status', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    res.json({
      balance:         user.balance,
      pending:         user.calcPending(),
      perSec:          user.calcPerSec(),
      lastCollectTime: user.lastCollectTime,
      nextCollectAt:   new Date(user.lastCollectTime.getTime() + COLLECT_COOLDOWN_MS),
      gpus:            user.gpus,
      referralPending: user.referralPending,
    });
  } catch (err) {
    console.error('status error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
