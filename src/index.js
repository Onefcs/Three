require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const rateLimit = require('express-rate-limit');
const mongoose = require('mongoose');
const path = require('path');
const { port, mongoUri } = require('./config');
const { createBot } = require('./bot');

const app = express();

app.use(cors());
app.use(express.json());

// Rate limiting: prevent API abuse
const apiLimiter = rateLimit({ windowMs: 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const authLimiter = rateLimit({ windowMs: 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false });
const collectLimiter = rateLimit({ windowMs: 60 * 1000, max: 5, standardHeaders: true, legacyHeaders: false });

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth',             authLimiter,    require('./routes/auth'));
app.use('/api/collect',          collectLimiter);
app.use('/api/referral/collect', collectLimiter);
app.use('/api/referral',         apiLimiter,     require('./routes/referral'));
app.use('/api/deposit',          apiLimiter,     require('./routes/deposit'));
app.use('/api',                  apiLimiter,     require('./routes/mining'));

// Health check
app.get('/health', (_, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (_, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

async function start() {
  if (!mongoUri) {
    console.error('MONGODB_URI is not set');
    process.exit(1);
  }
  await mongoose.connect(mongoUri);
  console.log('MongoDB connected');
  app.locals.bot = createBot();
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch(err => {
  console.error('Startup error', err);
  process.exit(1);
});
