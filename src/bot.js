const _TBotModule = require('node-telegram-bot-api');
const TelegramBot = _TBotModule.default || _TBotModule;
const { botToken, adminTelegramId, appUrl, botUsername } = require('./config');
const User = require('./models/User');
const Deposit = require('./models/Deposit');

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

    const [action, depositId] = (query.data || '').split(':');

    try {
      const deposit = await Deposit.findById(depositId);
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
          `💎 +${deposit.coreAmount.toLocaleString()} CORE\n` +
          `💰 ${deposit.tonAmount.toFixed(4)} TON\n` +
          `🔑 MEMO: \`${deposit.memo}\``,
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
          `💎 ${deposit.coreAmount.toLocaleString()} CORE\n` +
          `💰 ${deposit.tonAmount.toFixed(4)} TON\n` +
          `🔑 MEMO: \`${deposit.memo}\``,
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
