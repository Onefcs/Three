const _TBotModule = require('node-telegram-bot-api');
const TelegramBot = _TBotModule.default || _TBotModule;
const { botToken, adminTelegramId, appUrl, botUsername } = require('./config');
const User = require('./models/User');
const Deposit = require('./models/Deposit');
const Withdraw = require('./models/Withdraw');
const Halving = require('./models/Halving');
const SocialSubmission = require('./models/SocialSubmission');

const HALVING_POOL = 2_000_000;

function createBot() {
  if (!botToken) {
    console.warn('BOT_TOKEN not set — bot disabled');
    return null;
  }

  const bot = new TelegramBot(botToken, { polling: true });

  // /start [refId]
  bot.onText(/\/start ?(.*)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const refParam = (match[1] || '').trim();
    const webUrl = refParam ? `${appUrl}?ref=${refParam}` : appUrl;

    const name = msg.from.first_name || 'майнер';
    const text =
      `👋 Привет, ${name}!\n\n` +
      `⛏ *Core Mining* — зарабатывай CORE токены каждые 5 часов!\n\n` +
      `💎 Прокачивай видеокарты\n` +
      `💰 Собирай доход раз в 5 часов\n` +
      `👥 Приглашай друзей и получай 5% с их дохода\n\n` +
      `Нажми кнопку ниже и начни майнить прямо сейчас!`;

    await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [[
          { text: '⛏ Открыть Core Mining', web_app: { url: webUrl } },
        ]],
      },
    });
  });

  // Inline button callbacks from admin
  bot.on('callback_query', async (query) => {
    const fromId = String(query.from.id);
    if (!adminTelegramId || fromId !== String(adminTelegramId)) {
      return bot.answerCallbackQuery(query.id, { text: '⛔ Нет доступа' });
    }

    const [action, recordId] = (query.data || '').split(':');

    try {
      /* ── DEPOSIT ── */
      if (action === 'dep_confirm' || action === 'dep_reject') {
      const deposit = await Deposit.findById(recordId);
      if (!deposit) {
        return bot.answerCallbackQuery(query.id, { text: 'Заявка не найдена' });
      }
      if (deposit.status !== 'pending') {
        return bot.answerCallbackQuery(query.id, { text: 'Уже обработана' });
      }

      const userTag = deposit.username ? `@${deposit.username}` : deposit.firstName;

      if (action === 'dep_confirm') {
        deposit.status = 'confirmed';
        await deposit.save();

        await User.updateOne(
          { telegramId: deposit.telegramId },
          { $inc: { balance: deposit.coreAmount } }
        );

        await bot.editMessageText(
          `✅ *ПОДТВЕРЖДЕНО*\n\n👤 ${deposit.firstName} (${userTag})\n` +
          `💎 +${deposit.coreAmount.toLocaleString()} CORE` +
          (deposit.memo ? `\n🔑 \`${deposit.memo}\`` : ''),
          { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );

        try {
          await bot.sendMessage(
            deposit.telegramId,
            `✅ Депозит *${deposit.coreAmount.toLocaleString()} CORE* подтверждён и зачислен на ваш баланс!`,
            { parse_mode: 'Markdown' }
          );
        } catch (_) {}

        await bot.answerCallbackQuery(query.id, { text: '✅ Подтверждено' });

      } else if (action === 'dep_reject') {
        deposit.status = 'rejected';
        await deposit.save();

        await bot.editMessageText(
          `❌ *ОТКЛОНЕНО*\n\n👤 ${deposit.firstName} (${userTag})\n` +
          `💎 ${deposit.coreAmount.toLocaleString()} CORE` +
          (deposit.memo ? `\n🔑 \`${deposit.memo}\`` : ''),
          { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
        );

        try {
          await bot.sendMessage(
            deposit.telegramId,
            `❌ Депозит на *${deposit.coreAmount.toLocaleString()} CORE* отклонён. Обратитесь в поддержку.`,
            { parse_mode: 'Markdown' }
          );
        } catch (_) {}

        await bot.answerCallbackQuery(query.id, { text: '❌ Отклонено' });
      }
      } /* end deposit block */

      /* ── WITHDRAW ── */
      else if (action === 'wd_confirm' || action === 'wd_reject') {
        const withdraw = await Withdraw.findById(recordId);
        if (!withdraw) {
          return bot.answerCallbackQuery(query.id, { text: 'Заявка не найдена' });
        }
        if (withdraw.status !== 'pending') {
          return bot.answerCallbackQuery(query.id, { text: 'Уже обработана' });
        }

        const wdTag = withdraw.username ? `@${withdraw.username}` : withdraw.firstName;

        if (action === 'wd_confirm') {
          withdraw.status = 'confirmed';
          await withdraw.save();

          // Track withdrawal against halving pool
          try {
            const hState = await Halving.findOneAndUpdate(
              {},
              { $inc: { cycleWithdrawn: withdraw.coreAmount } },
              { new: true, upsert: true }
            );
            if (hState && hState.cycleWithdrawn >= HALVING_POOL) {
              await Halving.updateOne(
                {},
                { $inc: { halvingCount: 1 }, $set: { cycleWithdrawn: Math.max(0, hState.cycleWithdrawn - HALVING_POOL) } }
              );
              if (adminTelegramId) {
                await bot.sendMessage(
                  adminTelegramId,
                  `⚡ *ХАЛВИНГ!*\n\nВыведено ${HALVING_POOL.toLocaleString('ru-RU')} CORE суммарно. Доход всех майнеров уменьшен в 2 раза. Пул сброшен.`,
                  { parse_mode: 'Markdown' }
                );
              }
            }
          } catch (e) { console.error('halving update error', e.message); }

          await bot.editMessageText(
            `✅ *ВЫВОД ПОДТВЕРЖДЁН*\n\n👤 ${withdraw.firstName} (${wdTag})\n` +
            `💎 ${withdraw.coreAmount.toLocaleString()} CORE\n` +
            `👛 \`${withdraw.walletAddress}\``,
            { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );

          try {
            await bot.sendMessage(
              withdraw.telegramId,
              `✅ Вывод *${withdraw.coreAmount.toLocaleString()} CORE* подтверждён!`,
              { parse_mode: 'Markdown' }
            );
          } catch (_) {}

          await bot.answerCallbackQuery(query.id, { text: '✅ Подтверждено' });

        } else if (action === 'wd_reject') {
          withdraw.status = 'rejected';
          await withdraw.save();

          // Refund balance
          await User.updateOne(
            { telegramId: withdraw.telegramId },
            { $inc: { balance: withdraw.coreAmount } }
          );

          await bot.editMessageText(
            `❌ *ВЫВОД ОТКЛОНЁН*\n\n👤 ${withdraw.firstName} (${wdTag})\n` +
            `💎 ${withdraw.coreAmount.toLocaleString()} CORE (возвращено)\n` +
            `👛 \`${withdraw.walletAddress}\``,
            { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );

          try {
            await bot.sendMessage(
              withdraw.telegramId,
              `❌ Заявка на вывод *${withdraw.coreAmount.toLocaleString()} CORE* отклонена. Средства возвращены на баланс.`,
              { parse_mode: 'Markdown' }
            );
          } catch (_) {}

          await bot.answerCallbackQuery(query.id, { text: '❌ Отклонено' });
        }
      } /* end withdraw block */

      /* ── SOCIAL PROMOTION ── */
      else if (action === 'soc_confirm' || action === 'soc_reject') {
        const sub = await SocialSubmission.findById(recordId);
        if (!sub) return bot.answerCallbackQuery(query.id, { text: 'Заявка не найдена' });
        if (sub.status !== 'pending') return bot.answerCallbackQuery(query.id, { text: 'Уже обработана' });

        const platNames = { youtube: 'YouTube', tiktok: 'TikTok', x: 'X (Twitter)' };
        const platName = platNames[sub.platform] || sub.platform;
        const userTag = sub.username ? `@${sub.username}` : sub.firstName;

        if (action === 'soc_confirm') {
          sub.status = 'approved';
          await sub.save();

          // Grant RTX 3070
          const gpuId = 'rtx3070';
          const slotExists = await User.findOne({ telegramId: sub.telegramId, 'gpus.gpuId': gpuId });
          if (slotExists) {
            await User.updateOne({ telegramId: sub.telegramId, 'gpus.gpuId': gpuId }, { $inc: { 'gpus.$.count': 1 } });
          } else {
            await User.updateOne({ telegramId: sub.telegramId }, { $push: { gpus: { gpuId, count: 1 } } });
          }

          await bot.editMessageText(
            `✅ *ОДОБРЕНО*\n\n👤 ${sub.firstName} (${userTag})\n📱 ${platName}\n🔗 ${sub.link}`,
            { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
          try {
            await bot.sendMessage(
              sub.telegramId,
              `✅ Ваша заявка на *${platName}* одобрена! RTX 3070 добавлен в ваш майнинг-парк 🎉`,
              { parse_mode: 'Markdown' }
            );
          } catch (_) {}
          await bot.answerCallbackQuery(query.id, { text: '✅ Одобрено' });

        } else {
          sub.status = 'rejected';
          await sub.save();

          await bot.editMessageText(
            `❌ *ОТКЛОНЕНО*\n\n👤 ${sub.firstName} (${userTag})\n📱 ${platName}\n🔗 ${sub.link}`,
            { chat_id: query.message.chat.id, message_id: query.message.message_id, parse_mode: 'Markdown' }
          );
          try {
            await bot.sendMessage(
              sub.telegramId,
              `❌ Заявка на *${platName}* отклонена. Обратитесь в поддержку.`,
              { parse_mode: 'Markdown' }
            );
          } catch (_) {}
          await bot.answerCallbackQuery(query.id, { text: '❌ Отклонено' });
        }
      } /* end social block */

    } catch (err) {
      console.error('bot callback error', err);
      await bot.answerCallbackQuery(query.id, { text: 'Ошибка обработки' });
    }
  });

  bot.on('polling_error', (err) => console.error('Polling error:', err.message));

  console.log('Telegram bot started');
  return bot;
}

module.exports = { createBot };
