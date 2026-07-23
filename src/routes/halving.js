const router = require('express').Router();
const { requireAuth } = require('../middleware/telegramAuth');
const Halving = require('../models/Halving');

const POOL_SIZE = 2_000_000;

router.get('/', requireAuth, async (req, res) => {
  try {
    const h = await Halving.getSingleton();
    res.json({
      halvingCount:   h.halvingCount,
      cycleWithdrawn: h.cycleWithdrawn,
      poolSize:       POOL_SIZE,
      multiplier:     Math.pow(0.5, h.halvingCount),
    });
  } catch (err) {
    console.error('halving status error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
