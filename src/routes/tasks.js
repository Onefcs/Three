const router = require('express').Router();
const { requireAuth } = require('../middleware/telegramAuth');
const User = require('../models/User');
const Task = require('../models/Task');

const COST_PER_CLICK = 100;   // 100 CORE per slot
const REWARD_PER_CLICK = 50;  // 50 CORE to completing user (50 burned)
const MIN_CLICKS = 100;
const MIN_COST = MIN_CLICKS * COST_PER_CLICK; // 10 000 CORE minimum

// GET /api/tasks — active tasks the user hasn't completed (own tasks included, marked isOwn)
router.get('/', requireAuth, async (req, res) => {
  try {
    const tasks = await Task.find({
      status: 'active',
      completedBy: { $ne: req.user.telegramId },
    }).sort({ createdAt: -1 }).limit(50);

    res.json({ tasks: tasks.map(t => ({
      _id:         String(t._id),
      title:       t.title,
      description: t.description,
      link:        t.link,
      reward:      t.rewardPerClick,
      remaining:   t.maxClicks - t.clickCount,
      maxClicks:   t.maxClicks,
      isOwn:       t.creatorId === req.user.telegramId,
    })) });
  } catch (err) {
    console.error('tasks list error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/create
router.post('/create', requireAuth, async (req, res) => {
  try {
    const title       = (req.body.title || '').trim();
    const description = (req.body.description || '').trim();
    const link        = (req.body.link || '').trim();
    const coreAmount  = Number(req.body.coreAmount);

    if (!title || title.length > 20)
      return res.status(400).json({ error: 'Название: до 20 символов' });
    if (description.length > 50)
      return res.status(400).json({ error: 'Описание: до 50 символов' });
    if (!link || !/^https?:\/\/.+/.test(link))
      return res.status(400).json({ error: 'Укажите корректную ссылку (https://...)' });
    if (!coreAmount || coreAmount < MIN_COST)
      return res.status(400).json({ error: `Минимум ${MIN_COST.toLocaleString()} CORE` });

    const maxClicks = Math.floor(coreAmount / COST_PER_CLICK);

    const user = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId, balance: { $gte: coreAmount } },
      { $inc: { balance: -coreAmount } },
      { new: true }
    );
    if (!user) return res.status(400).json({ error: 'Недостаточно CORE' });

    const task = await Task.create({
      creatorId: req.user.telegramId,
      title,
      description,
      link,
      coreAmount,
      maxClicks,
      rewardPerClick: REWARD_PER_CLICK,
    });

    res.json({ taskId: String(task._id), balance: user.balance, maxClicks });
  } catch (err) {
    console.error('task create error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/tasks/:id/complete
router.post('/:id/complete', requireAuth, async (req, res) => {
  try {
    const task = await Task.findOneAndUpdate(
      {
        _id: req.params.id,
        status: 'active',
        completedBy: { $ne: req.user.telegramId },
        creatorId:   { $ne: req.user.telegramId },
        $expr: { $lt: ['$clickCount', '$maxClicks'] },
      },
      {
        $inc:  { clickCount: 1 },
        $push: { completedBy: req.user.telegramId },
      },
      { new: true }
    );

    if (!task) return res.status(400).json({ error: 'Задание недоступно или уже выполнено вами' });

    if (task.clickCount >= task.maxClicks) {
      await Task.updateOne({ _id: task._id }, { status: 'completed' });
    }

    const user = await User.findOneAndUpdate(
      { telegramId: req.user.telegramId },
      { $inc: { balance: task.rewardPerClick } },
      { new: true }
    );

    res.json({ reward: task.rewardPerClick, balance: user.balance });
  } catch (err) {
    console.error('task complete error', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
