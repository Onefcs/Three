const router = require('express').Router();
const PromoCode = require('../models/PromoCode');
const User = require('../models/User');
const { requireAuth } = require('../middleware/telegramAuth');

// POST /api/promo/redeem
router.post('/redeem', requireAuth, async (req, res) => {
  try {
    const { code } = req.body || {};
    if (!code || !code.trim()) return res.status(400).json({ error: 'Введите промокод' });

    const promo = await PromoCode.findOne({ code: code.trim().toUpperCase() });
    if (!promo || !promo.isActive) return res.status(404).json({ error: 'Промокод не найден или неактивен' });
    if (promo.expiresAt && promo.expiresAt < new Date()) return res.status(400).json({ error: 'Промокод истёк' });
    if (promo.maxUses > 0 && promo.usedCount >= promo.maxUses) return res.status(400).json({ error: 'Лимит активаций исчерпан' });
    if (promo.usedBy.includes(req.user.telegramId)) return res.status(400).json({ error: 'Вы уже использовали этот промокод' });

    await Promise.all([
      User.updateOne({ telegramId: req.user.telegramId }, { $inc: { balance: promo.value } }),
      PromoCode.updateOne({ _id: promo._id }, { $inc: { usedCount: 1 }, $push: { usedBy: req.user.telegramId } }),
    ]);

    res.json({ ok: true, value: promo.value });
  } catch (err) {
    console.error('promo redeem error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
