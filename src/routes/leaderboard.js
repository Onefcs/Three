const router = require('express').Router();
const User = require('../models/User');
const Halving = require('../models/Halving');
const { GPU_CATALOG } = require('../config');

// GET /api/leaderboard?type=balance|income|referrals
router.get('/', async (req, res) => {
  try {
    const type = req.query.type || 'balance';

    if (type === 'referrals') {
      const top = await User.aggregate([
        { $lookup: { from: 'users', localField: 'telegramId', foreignField: 'referredBy', as: 'refs' } },
        { $addFields: { refCount: { $size: '$refs' } } },
        { $match: { refCount: { $gt: 0 } } },
        { $sort: { refCount: -1 } },
        { $limit: 50 },
        { $project: { telegramId: 1, username: 1, firstName: 1, refCount: 1 } },
      ]);
      return res.json({ top: top.map((u, i) => ({
        rank: i + 1,
        name: u.firstName || u.username || '???',
        value: u.refCount,
        isSelf: false,
      })) });
    }

    if (type === 'income') {
      const h = await Halving.getSingleton();
      const multiplier = Math.pow(0.5, h.halvingCount);
      const users = await User.find({}, 'telegramId username firstName gpus').lean();
      const ranked = users
        .map(u => {
          const perSec = (u.gpus || []).reduce((sum, slot) => {
            const gpu = GPU_CATALOG[slot.gpuId];
            return gpu ? sum + (gpu.incomePerHour * slot.count) / 3600 : sum;
          }, 0) * multiplier;
          return { telegramId: u.telegramId, name: u.firstName || u.username || '???', value: perSec };
        })
        .filter(u => u.value > 0)
        .sort((a, b) => b.value - a.value)
        .slice(0, 50);
      return res.json({ top: ranked.map((u, i) => ({ rank: i + 1, ...u })) });
    }

    // balance (default)
    const top = await User.find({}, 'telegramId username firstName balance').sort({ balance: -1 }).limit(50).lean();
    res.json({ top: top.map((u, i) => ({
      rank: i + 1,
      telegramId: u.telegramId,
      name: u.firstName || u.username || '???',
      value: u.balance,
    })) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
