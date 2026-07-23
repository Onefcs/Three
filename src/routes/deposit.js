const router = require('express').Router();
const { requireAuth } = require('../middleware/telegramAuth');
const User = require('../models/User');
const Deposit = require('../models/Deposit');
const { adminTelegramId } = require('../config');

// POST /api/deposit/request
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

    const deposit = await Deposit.create({
      telegramId: req.user.telegramId,
      username:   user.username,
      firstName:  user.firstName,
      coreAmount,
    });

    // Notify admin
    const bot = req.app.locals.bot;
    if (bot && adminTelegramId) {
      const userTag = user.username ? `@${user.username}` : user.firstName || req.user.telegramId;
      const text =
        `💰 *Заявка на пополнение CORE*\n\n` +
        `👤 ${user.firstName || '—'} (${userTag})\n` +
        `🆔 \`${req.user.telegramId}\`\n` +
        `💎 *${coreAmount.toLocaleString()} CORE*\n` +
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

    res.json({ depositId: String(deposit._id), coreAmount });
  } catch (err) {
    console.error('deposit request error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
