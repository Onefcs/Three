const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');
const { GPU_CATALOG, REFERRAL_PERCENT } = require('../config');

// POST /api/collect  — collect pending mining income
router.post('/collect', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const earned = user.calcPending();
    if (earned <= 0) return res.json({ collected: 0, balance: user.balance });

    user.balance += earned;
    user.lastCollectTime = new Date();

    // Credit referrer 5% of this collect
    if (user.referredBy) {
      const bonus = earned * (REFERRAL_PERCENT / 100);
      await User.updateOne(
        { telegramId: user.referredBy },
        { $inc: { referralPending: bonus, referralEarned: bonus } }
      );
    }

    await user.save();
    res.json({ collected: earned, balance: user.balance });
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

    // Collect pending before purchase so balance is current
    const earned = user.calcPending();
    if (earned > 0) {
      user.balance += earned;
      user.lastCollectTime = new Date();
      if (user.referredBy) {
        const bonus = earned * (REFERRAL_PERCENT / 100);
        await User.updateOne(
          { telegramId: user.referredBy },
          { $inc: { referralPending: bonus, referralEarned: bonus } }
        );
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
