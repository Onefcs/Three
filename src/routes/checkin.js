const router = require('express').Router();
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');

const DAY_MS = 24 * 60 * 60 * 1000;
const DAILY_CORE = 10;
const GPU_DAYS = { 15: 'rtx3060ti', 30: 'rtx3060ti' };

function daysSince(date) {
  const now = new Date();
  const d = new Date(date);
  const nowMid = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dMid = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((nowMid - dMid) / DAY_MS);
}

// GET /api/checkin
router.get('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId }, 'checkInStreak lastCheckIn').lean();
    const streak = user.checkInStreak || 0;
    const lastCheckIn = user.lastCheckIn || null;
    const canCheckIn = !lastCheckIn || daysSince(lastCheckIn) >= 1;

    let claimedInCycle;
    if (canCheckIn) {
      claimedInCycle = streak % 30;
    } else {
      claimedInCycle = ((streak - 1) % 30) + 1;
    }

    res.json({ streak, lastCheckIn, canCheckIn, claimedInCycle });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/checkin
router.post('/', requireAuth, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.user.telegramId });
    const lastCheckIn = user.lastCheckIn;
    const days = lastCheckIn ? daysSince(lastCheckIn) : null;

    if (days === 0) return res.status(400).json({ error: 'Уже отмечено сегодня' });

    let streak = user.checkInStreak || 0;
    if (!lastCheckIn || days > 1) {
      streak = 1;
    } else {
      streak += 1;
    }

    const day = ((streak - 1) % 30) + 1;
    const gpuId = GPU_DAYS[day] || null;
    const now = new Date();
    const baseUpdate = { lastCheckIn: now, checkInStreak: streak };

    if (gpuId) {
      const slot = user.gpus.find(s => s.gpuId === gpuId);
      if (slot) {
        await User.updateOne(
          { telegramId: req.user.telegramId, 'gpus.gpuId': gpuId },
          { $inc: { 'gpus.$.count': 1 }, $set: baseUpdate }
        );
      } else {
        await User.updateOne(
          { telegramId: req.user.telegramId },
          { $push: { gpus: { gpuId, count: 1 } }, $set: baseUpdate }
        );
      }
      return res.json({ ok: true, streak, day, reward: null, gpuId });
    } else {
      await User.updateOne(
        { telegramId: req.user.telegramId },
        { $inc: { balance: DAILY_CORE }, $set: baseUpdate }
      );
      return res.json({ ok: true, streak, day, reward: DAILY_CORE, gpuId: null });
    }
  } catch (err) {
    console.error('checkin error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
