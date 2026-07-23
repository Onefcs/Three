const router = require('express').Router();
const { requireAuth } = require('../middleware/telegramAuth');
const User = require('../models/User');
const Withdraw = require('../models/Withdraw');
const { adminTelegramId } = require('../config');

// POST /api/withdraw/request
router.post('/request', requireAuth, async (req, res) => {
  try {
    const coreAmount = Number(req.body.coreAmount);
    const walletAddress = (req.body.walletAddress || '').trim();

    if (!walletAddress) return res.status(400).json({ error: 'Укажите адрес кошелька' });
    if (!coreAmount || coreAmount < 1000) return res.status(400).json({ error: 'Минимум 1 000 CORE' });
    if (coreAmount > 10_000_000) return res.status(400).json({ error: 'Максимум 10 000 000 CORE' });

    // Deduct balance atomically — prevents double-spend
    const user = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId, balance: { $gte: coreAmount } },
      { $inc: { balance: -coreAmount } },
      { new: true }
    );
    if (!user) return res.status(400).json({ error: 'Недостаточно CORE на балансе' });

    const withdraw = await Withdraw.create({
      telegramId: req.user.telegramId,
      username:   user.username,
      firstName:  user.firstName,
      coreAmount,
      walletAddress,
    });

    const bot = req.app.locals.bot;
    if (bot && adminTelegramId) {
      const userTag = user.username ? `@${user.username}` : user.firstName || req.user.telegramId;
      const text =
        `💸 *Заявка на вывод CORE*\n\n` +
        `👤 ${user.firstName || '—'} (${userTag})\n` +
        `🆔 \`${req.user.telegramId}\`\n` +
        `💎 *${coreAmount.toLocaleString()} CORE*\n` +
        `👛 \`${walletAddress}\`\n` +
        `📅 ${new Date().toLocaleString('ru-RU')}`;

      try {
        const msg = await bot.sendMessage(adminTelegramId, text, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Подтвердить', callback_data: `wd_confirm:${withdraw._id}` },
              { text: '❌ Отклонить',  callback_data: `wd_reject:${withdraw._id}` },
            ]],
          },
        });
        withdraw.adminMessageId = msg.message_id;
        await withdraw.save();
      } catch (e) {
        console.error('admin notify error', e.message);
      }
    }

    res.json({ withdrawId: String(withdraw._id), coreAmount, balance: user.balance });
  } catch (err) {
    console.error('withdraw request error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
