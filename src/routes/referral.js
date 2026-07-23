const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');
const { botUsername } = require('../config');

// GET /api/referral  — referral stats + link
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });

    if (!user) return res.status(404).json({ error: 'User not found' });

    const referralCount = await User.countDocuments({ referredBy: req.user.telegramId });

    res.json({
      referralLink:    `https://t.me/${botUsername}?start=${req.user.telegramId}`,
      referralCount,
      referralPending: user.referralPending,
      referralEarned:  user.referralEarned,
    });
  } catch (err) {
    console.error('referral error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/referral/collect  — collect accumulated referral bonuses
router.post('/collect', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    if (user.referralPending <= 0) return res.json({ collected: 0, balance: user.balance });

    const amount = user.referralPending;
    const updated = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId, referralPending: { $gt: 0 } },
      { $inc: { balance: amount }, $set: { referralPending: 0 } },
      { new: true }
    );

    if (!updated) return res.json({ collected: 0, balance: user.balance });
    res.json({ collected: amount, balance: updated.balance });
  } catch (err) {
    console.error('referral collect error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
