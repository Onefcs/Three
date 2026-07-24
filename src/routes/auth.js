const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const UserLog = require('../models/UserLog');
const { verifyTelegramInitData } = require('../middleware/telegramAuth');
const { jwtSecret, botUsername, appUrl, COLLECT_COOLDOWN_MS } = require('../config');

// POST /api/auth
// Body: { initData: string, referredBy?: string }
router.post('/', async (req, res) => {
  try {
    const { initData, referredBy } = req.body;
    if (!initData) return res.status(400).json({ error: 'initData required' });

    const tgUser = verifyTelegramInitData(initData);
    if (!tgUser) return res.status(401).json({ error: 'Invalid initData' });

    const telegramId = String(tgUser.id);
    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0].trim()
      || req.socket?.remoteAddress || '';

    let user = await User.findOne({ telegramId });
    let isNew = false;

    if (!user) {
      const data = {
        telegramId,
        username:  tgUser.username  || '',
        firstName: tgUser.first_name || '',
        lastName:  tgUser.last_name  || '',
        photoUrl:  tgUser.photo_url  || '',
        lastIp:    ip,
        knownIps:  ip ? [ip] : [],
      };

      // Validate referral
      if (referredBy && referredBy !== telegramId) {
        const referrer = await User.findOne({ telegramId: referredBy });
        if (referrer) data.referredBy = referredBy;
      }

      user = await User.create(data);
      isNew = true;
    } else {
      if (user.isBanned) {
        return res.status(403).json({ error: 'Account banned', reason: user.banReason });
      }
      // Update profile info on each login
      user.username  = tgUser.username  || user.username;
      user.firstName = tgUser.first_name || user.firstName;
      user.lastName  = tgUser.last_name  || user.lastName;
      user.lastActive = new Date();
      if (ip) {
        user.lastIp = ip;
        if (!user.knownIps.includes(ip)) user.knownIps.push(ip);
      }
      await user.save();
    }

    UserLog.create({ telegramId, action: 'login', details: { isNew }, ip }).catch(() => {});

    const token = jwt.sign({ telegramId }, jwtSecret, { expiresIn: '30d' });

    res.json({
      token,
      user: {
        telegramId:      user.telegramId,
        username:        user.username,
        firstName:       user.firstName,
        balance:         user.balance,
        lastCollectTime: user.lastCollectTime,
        nextCollectAt:   new Date(user.lastCollectTime.getTime() + COLLECT_COOLDOWN_MS),
        referralPending: user.referralPending,
        gpus:            user.gpus,
        referralLink:    `https://t.me/${botUsername}?start=${telegramId}`,
        referralWebLink: `${appUrl}?ref=${telegramId}`,
      },
    });
  } catch (err) {
    console.error('auth error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
