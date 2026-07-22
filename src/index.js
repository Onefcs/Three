require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const mongoose = require('mongoose');
const path = require('path');
const { port, mongoUri } = require('./config');

const app = express();

app.use(cors());
app.use(express.json());

// Serve frontend
app.use(express.static(path.join(__dirname, '../public')));

// API routes
app.use('/api/auth',     require('./routes/auth'));
app.use('/api/referral', require('./routes/referral'));
app.use('/api',          require('./routes/mining'));

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
  app.listen(port, () => console.log(`Server running on port ${port}`));
}

start().catch(err => {
  console.error('Startup error', err);
  process.exit(1);
});
