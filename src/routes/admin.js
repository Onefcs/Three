const router = require('express').Router();
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Task = require('../models/Task');
const Deposit = require('../models/Deposit');
const Withdraw = require('../models/Withdraw');
const Halving = require('../models/Halving');
const UserLog = require('../models/UserLog');
const { adminUsername, adminPassword, jwtSecret, GPU_CATALOG } = require('../config');

const ADMIN_SECRET = (process.env.ADMIN_JWT_SECRET || jwtSecret) + '-admin';

function requireAdmin(req, res, next) {
  const token = (req.headers.authorization || '').replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  try {
    req.admin = jwt.verify(token, ADMIN_SECRET);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

async function getMultiplier() {
  const h = await Halving.getSingleton();
  return Math.pow(0.5, h.halvingCount);
}

// POST /api/admin/login
router.post('/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password || username !== adminUsername || password !== adminPassword) {
    return res.status(401).json({ error: 'Неверный логин или пароль' });
  }
  const token = jwt.sign({ role: 'admin' }, ADMIN_SECRET, { expiresIn: '24h' });
  res.json({ token });
});

// GET /api/admin/stats
router.get('/stats', requireAdmin, async (req, res) => {
  try {
    const [userCount, bannedCount, depositAgg, withdrawAgg, balanceAgg, halvingState] = await Promise.all([
      User.countDocuments(),
      User.countDocuments({ isBanned: true }),
      Deposit.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: '$coreAmount' } } }]),
      Withdraw.aggregate([{ $match: { status: 'confirmed' } }, { $group: { _id: null, total: { $sum: '$coreAmount' } } }]),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$balance' } } }]),
      Halving.getSingleton(),
    ]);
    res.json({
      userCount,
      bannedCount,
      totalBalance: Math.round((balanceAgg[0]?.total || 0) * 100) / 100,
      totalDeposited: depositAgg[0]?.total || 0,
      totalWithdrawn: withdrawAgg[0]?.total || 0,
      halvingCount: halvingState.halvingCount,
      cycleWithdrawn: halvingState.cycleWithdrawn,
    });
  } catch (err) {
    console.error('admin stats error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/players?search=&page=&limit=
router.get('/players', requireAdmin, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 25));
    const search = (req.query.search || '').trim();

    const query = {};
    if (search) {
      query.$or = [
        { telegramId: search },
        { username: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastIp: search },
      ];
    }

    const [users, total, multiplier] = await Promise.all([
      User.find(query).sort({ lastActive: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(query),
      getMultiplier(),
    ]);

    // calcPerSec needs the method, so we compute manually
    const mapped = users.map(u => {
      const perSec = (u.gpus || []).reduce((sum, slot) => {
        const gpu = GPU_CATALOG[slot.gpuId];
        return gpu ? sum + (gpu.incomePerHour * slot.count) / 3600 : sum;
      }, 0) * multiplier;
      return {
        _id: String(u._id),
        telegramId: u.telegramId,
        username: u.username || '',
        firstName: u.firstName || '',
        balance: u.balance,
        perSec,
        gpus: u.gpus || [],
        gpuCount: (u.gpus || []).reduce((s, g) => s + g.count, 0),
        referredBy: u.referredBy || null,
        referralEarned: u.referralEarned || 0,
        lastIp: u.lastIp || '',
        isBanned: u.isBanned || false,
        banReason: u.banReason || '',
        createdAt: u.createdAt,
        lastActive: u.lastActive,
      };
    });

    res.json({ users: mapped, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    console.error('admin players error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/players/:telegramId
router.get('/players/:telegramId', requireAdmin, async (req, res) => {
  try {
    const user = await User.findOne({ telegramId: req.params.telegramId }).lean();
    if (!user) return res.status(404).json({ error: 'Not found' });

    const multiplier = await getMultiplier();
    const perSec = (user.gpus || []).reduce((sum, slot) => {
      const gpu = GPU_CATALOG[slot.gpuId];
      return gpu ? sum + (gpu.incomePerHour * slot.count) / 3600 : sum;
    }, 0) * multiplier;

    const FARM_SECS = 5 * 60 * 60;
    const secondsElapsed = Math.min((Date.now() - new Date(user.lastCollectTime).getTime()) / 1000, FARM_SECS);
    const pending = perSec / multiplier * secondsElapsed * multiplier;

    const [referrer, referralCount, relatedByIp, relatedByHwid] = await Promise.all([
      user.referredBy ? User.findOne({ telegramId: user.referredBy }, 'telegramId username firstName').lean() : null,
      User.countDocuments({ referredBy: user.telegramId }),
      user.lastIp
        ? User.find({ lastIp: user.lastIp, telegramId: { $ne: user.telegramId } }, 'telegramId username firstName isBanned lastActive').limit(20).lean()
        : [],
      user.hwid
        ? User.find({ hwid: user.hwid, telegramId: { $ne: user.telegramId } }, 'telegramId username firstName isBanned lastActive').limit(20).lean()
        : [],
    ]);

    res.json({
      _id: String(user._id),
      telegramId: user.telegramId,
      username: user.username || '',
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      balance: user.balance,
      perSec,
      pending,
      gpus: user.gpus || [],
      referredBy: user.referredBy || null,
      referrer: referrer ? { telegramId: referrer.telegramId, name: referrer.firstName || referrer.username } : null,
      referralCount,
      referralEarned: user.referralEarned || 0,
      referralPending: user.referralPending || 0,
      lastIp: user.lastIp || '',
      knownIps: user.knownIps || [],
      hwid: user.hwid || '',
      isBanned: user.isBanned || false,
      banReason: user.banReason || '',
      createdAt: user.createdAt,
      lastActive: user.lastActive,
      relatedByIp: relatedByIp.map(u => ({
        telegramId: u.telegramId,
        name: u.firstName || u.username || u.telegramId,
        isBanned: u.isBanned || false,
      })),
      relatedByHwid: relatedByHwid.map(u => ({
        telegramId: u.telegramId,
        name: u.firstName || u.username || u.telegramId,
        isBanned: u.isBanned || false,
      })),
    });
  } catch (err) {
    console.error('admin player detail error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/players/:telegramId/logs
router.get('/players/:telegramId/logs', requireAdmin, async (req, res) => {
  try {
    const logs = await UserLog.find({ telegramId: req.params.telegramId })
      .sort({ createdAt: -1 }).limit(100).lean();
    res.json({ logs });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/players/:telegramId/ban
router.post('/players/:telegramId/ban', requireAdmin, async (req, res) => {
  try {
    const { reason } = req.body || {};
    await User.updateOne({ telegramId: req.params.telegramId }, { $set: { isBanned: true, banReason: reason || '' } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/players/:telegramId/unban
router.post('/players/:telegramId/unban', requireAdmin, async (req, res) => {
  try {
    await User.updateOne({ telegramId: req.params.telegramId }, { $set: { isBanned: false, banReason: '' } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/players/:telegramId/balance  — overwrite balance
router.post('/players/:telegramId/balance', requireAdmin, async (req, res) => {
  try {
    const bal = parseFloat(req.body?.balance);
    if (isNaN(bal) || bal < 0) return res.status(400).json({ error: 'Invalid balance' });
    await User.updateOne({ telegramId: req.params.telegramId }, { $set: { balance: bal } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/admin/tasks
router.get('/tasks', requireAdmin, async (req, res) => {
  try {
    const tasks = await Task.find().sort({ createdAt: -1 }).limit(200).lean();
    res.json({
      tasks: tasks.map(t => ({
        _id: String(t._id),
        title: t.title,
        description: t.description,
        link: t.link,
        maxClicks: t.maxClicks,
        clickCount: t.clickCount,
        rewardPerClick: t.rewardPerClick,
        status: t.status,
        creatorId: t.creatorId,
        createdAt: t.createdAt,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/tasks  — admin creates task without paying
router.post('/tasks', requireAdmin, async (req, res) => {
  try {
    const { title, description, link, maxClicks, rewardPerClick } = req.body || {};
    if (!title || title.length > 60) return res.status(400).json({ error: 'Название обязательно (до 60 символов)' });
    if (!link || !/^https?:\/\/.+/.test(link)) return res.status(400).json({ error: 'Укажите корректную ссылку' });
    const clicks = Math.max(1, parseInt(maxClicks) || 100);
    const reward = Math.max(1, parseInt(rewardPerClick) || 50);
    const task = await Task.create({
      creatorId: 'admin',
      title: title.trim(),
      description: (description || '').trim(),
      link: link.trim(),
      coreAmount: clicks * reward,
      maxClicks: clicks,
      rewardPerClick: reward,
    });
    res.json({ ok: true, taskId: String(task._id) });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/admin/tasks/:id
router.delete('/tasks/:id', requireAdmin, async (req, res) => {
  try {
    await Task.deleteOne({ _id: req.params.id });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/admin/broadcast
router.post('/broadcast', requireAdmin, async (req, res) => {
  try {
    const { text, imageUrl, linkUrl, linkText } = req.body || {};
    if (!text || !text.trim()) return res.status(400).json({ error: 'Текст обязателен' });

    const bot = req.app.locals.bot;
    if (!bot) return res.status(503).json({ error: 'Bot not available' });

    const users = await User.find({ isBanned: { $ne: true } }, 'telegramId').lean();
    let sent = 0, failed = 0;

    const replyMarkup = (linkUrl && linkText)
      ? { inline_keyboard: [[{ text: linkText, url: linkUrl }]] }
      : undefined;

    async function trySend(telegramId) {
      const mkOpts = { parse_mode: 'Markdown', ...(replyMarkup ? { reply_markup: replyMarkup } : {}) };
      const plainOpts = replyMarkup ? { reply_markup: replyMarkup } : {};

      if (imageUrl) {
        try {
          await bot.sendPhoto(telegramId, imageUrl, { caption: text, ...mkOpts });
          return;
        } catch (_) {}
        // photo failed — try text only with markdown
        try {
          await bot.sendMessage(telegramId, text, mkOpts);
          return;
        } catch (_) {}
        // markdown failed — plain text
        await bot.sendMessage(telegramId, text, plainOpts);
      } else {
        try {
          await bot.sendMessage(telegramId, text, mkOpts);
          return;
        } catch (_) {}
        // markdown parse error — retry without parse_mode
        await bot.sendMessage(telegramId, text, plainOpts);
      }
    }

    for (const u of users) {
      try {
        await trySend(u.telegramId);
        sent++;
        if (sent % 25 === 0) await new Promise(r => setTimeout(r, 1000));
      } catch (_) {
        failed++;
      }
    }

    res.json({ ok: true, sent, failed, total: users.length });
  } catch (err) {
    console.error('broadcast error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
