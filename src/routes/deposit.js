const router = require('express').Router();
const crypto = require('crypto');
const { requireAuth } = require('../middleware/telegramAuth');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const { adminTelegramId, depositTonAddress } = require('../config');

// POST /api/deposit/request — creates record and returns address/memo (no admin notify yet)
router.post('/request', requireAuth, async (req, res) => {
  try {
    const coreAmount = Number(req.body.coreAmount);
    if (!coreAmount || coreAmount < 1000) {
      return res.status(400).json({ error: 'Минимум 1 000 CORE' });
    }
    if (coreAmount > 10_000_000) {
      return res.status(400).json({ error: 'Максимум 10 000 000 CORE' });
    }

    const user = await User.findOne({ telegramId: req.user.telegramId });
    if (!user) return res.status(404).json({ error: 'User not found' });

    const memo = `DEP-${req.user.telegramId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const deposit = await Deposit.create({
      telegramId: req.user.telegramId,
      username:   user.username,
      firstName:  user.firstName,
      coreAmount,
      memo,
    });

    res.json({ depositId: String(deposit._id), coreAmount, tonAddress: depositTonAddress, memo });
  } catch (err) {
    console.error('deposit request error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/deposit/paid — user confirms payment; notifies admin
router.post('/paid', requireAuth, async (req, res) => {
  try {
    const { depositId } = req.body;
    if (!depositId) return res.status(400).json({ error: 'depositId required' });

    const deposit = await Deposit.findOne({
      _id: depositId,
      telegramId: req.user.telegramId,
      status: 'pending',
    });
    if (!deposit) return res.status(404).json({ error: 'Заявка не найдена' });

    const user = await User.findOne({ telegramId: req.user.telegramId });
    const bot = req.app.locals.bot;
    if (bot && adminTelegramId && user) {
      const userTag = user.username ? `@${user.username}` : user.firstName || req.user.telegramId;
      const text =
        `💰 *Заявка на пополнение*\n\n` +
        `👤 ${user.firstName || '—'} (${userTag})\n` +
        `🆔 \`${req.user.telegramId}\`\n` +
        `💎 *${deposit.coreAmount.toLocaleString()} CORE*\n` +
        `🔑 MEMO: \`${deposit.memo}\`\n` +
        `📅 ${new Date().toLocaleString('ru-RU')}`;

      try {
        const msg = await bot.sendMessage(adminTelegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Подтвердить', callback_data: `dep_confirm:${deposit._id}` },
              { text: '❌ Отклонить',  callback_data: `dep_reject:${deposit._id}` },
            ]],
          },
        });
        deposit.adminMessageId = msg.message_id;
        await deposit.save();
      } catch (e) {
        console.error('admin notify error', e.message);
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('deposit paid error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
