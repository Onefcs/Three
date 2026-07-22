const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');
const { GPU_CATALOG, REFERRAL_PERCENT } = require('../config');

// POST /api/collect  — collect pending mining income (atomic, race-safe)
router.post('/collect', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const earned = user.calcPending();
    if (earned < 0.001) return res.json({ collected: 0, balance: user.balance });

    const prevCollectTime = user.lastCollectTime;
    const now = new Date();

    // Atomic update: only apply if lastCollectTime hasn't changed since we read it.
    // If another device already collected, this findOneAndUpdate returns null.
    const updated = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId, lastCollectTime: prevCollectTime },
      { $inc: { balance: earned }, $set: { lastCollectTime: now, lastActive: now } },
      { new: true }
    );

    if (!updated) {
      // Race lost — another device collected first, return fresh state
      const fresh = await User.findOne({ telegramId: req.user.telegramId });
      return res.json({ collected: 0, balance: fresh.balance });
    }

    // Credit referrer 5%
    if (user.referredBy) {
      const bonus = earned * (REFERRAL_PERCENT / 100);
      await User.updateOne(
        { telegramId: user.referredBy },
        { $inc: { referralPending: bonus, referralEarned: bonus } }
      );
    }

    res.json({ collected: earned, balance: updated.balance });
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
      gpus:            user.gpus,
      referralPending: user.referralPending,
    });
  } catch (err) {
    console.error('status error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
