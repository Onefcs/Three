require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  mongoUri: process.env.MONGODB_URI,
  botToken: process.env.BOT_TOKEN,
  jwtSecret: process.env.JWT_SECRET || 'fallback-dev-secret',
  botUsername: process.env.BOT_USERNAME || 'CoreMiningBot',

  // GPU catalog matching the frontend
  GPU_CATALOG: {
    rtx3060:   { name: 'RTX 3060',    basePrice: 100,    incomePerHour: 0.0947   },
    rtx3060ti: { name: 'RTX 3060 Ti', basePrice: 1000,   incomePerHour: 0.9470   },
    rtx3070:   { name: 'RTX 3070',    basePrice: 5000,   incomePerHour: 4.7348   },
    rtx4070ti: { name: 'RTX 4070 Ti', basePrice: 30000,  incomePerHour: 28.4091  },
    rtx4080:   { name: 'RTX 4080',    basePrice: 70000,  incomePerHour: 66.2879  },
    rtx4090:   { name: 'RTX 4090',    basePrice: 150000, incomePerHour: 142.0455 },
  },

  adminTelegramId: process.env.ADMIN_TELEGRAM_ID || '',
  adminUsername: process.env.ADMIN_USERNAME || 'admin',
  adminPassword: process.env.ADMIN_PASSWORD || 'admin123',
  depositTonAddress: process.env.DEPOSIT_TON_ADDRESS || '',
  appUrl: process.env.APP_URL || 'https://two-production-eb6f.up.railway.app',

  REFERRAL_PERCENT: 5, // 5% of referee's collected income goes to referrer
  COLLECT_COOLDOWN_MS: 5 * 60 * 60 * 1000, // 5-hour farm window; collect resets the timer
};
