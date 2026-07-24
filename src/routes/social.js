const router = require('express').Router();
const { requireAuth } = require('../middleware/telegramAuth');
const SocialSubmission = require('../models/SocialSubmission');
const User = require('../models/User');
const { adminTelegramId } = require('../config');

const PLATFORMS = ['youtube', 'tiktok', 'x'];
const PLATFORM_NAMES = { youtube: 'YouTube', tiktok: 'TikTok', x: 'X (Twitter)' };

// GET /api/social/status  — user's submission per platform
router.get('/status', requireAuth, async (req, res) => {
  try {
    const subs = await SocialSubmission.find({ telegramId: req.user.telegramId });
    const result = {};
    for (const p of PLATFORMS) {
      const sub = subs.find(s => s.platform === p);
      result[p] = sub ? { status: sub.status, link: sub.link } : null;
    }
    res.json(result);
  } catch (err) {
    console.error('social status error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/social/submit  — submit a link for moderation
router.post('/submit', requireAuth, async (req, res) => {
  try {
    const { platform, link } = req.body;
    if (!PLATFORMS.includes(platform))
      return res.status(400).json({ error: 'Unknown platform' });
    if (!link || !/^https?:\/\/.+/.test(link))
      return res.status(400).json({ error: 'Укажите корректную ссылку (https://...)' });

    const existing = await SocialSubmission.findOne({
      telegramId: req.user.telegramId,
      platform,
      status: { $in: ['pending', 'approved'] },
    });
    if (existing) return res.status(400).json({ error: 'Заявка уже отправлена или одобрена' });

    const user = await User.findOne({ telegramId: req.user.telegramId });
    const sub = await SocialSubmission.create({
      telegramId: req.user.telegramId,
      firstName:  user?.firstName || '',
      username:   user?.username  || '',
      platform,
      link,
    });

    const bot = req.app.locals.bot;
    if (bot && adminTelegramId) {
      const userTag = sub.username ? `@${sub.username}` : sub.firstName;
      await bot.sendMessage(
        adminTelegramId,
        `🌐 *Заявка на продвижение*\n\n` +
        `👤 ${sub.firstName} (${userTag})\n` +
        `📱 *${PLATFORM_NAMES[platform]}*\n` +
        `🔗 ${link}`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [[
              { text: '✅ Одобрить (+RTX 3070)', callback_data: `soc_confirm:${sub._id}` },
              { text: '❌ Отклонить',             callback_data: `soc_reject:${sub._id}` },
            ]],
          },
        }
      );
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('social submit error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
