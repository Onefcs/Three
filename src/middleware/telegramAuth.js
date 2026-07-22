const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { botToken, jwtSecret } = require('../config');

function verifyTelegramInitData(initData) {
  const params = new URLSearchParams(initData);
  const hash = params.get('hash');
  if (!hash) return null;

  params.delete('hash');
  const entries = [...params.entries()].sort(([a], [b]) => a.localeCompare(b));
  const dataCheckString = entries.map(([k, v]) => `${k}=${v}`).join('\n');

  const secretKey = crypto.createHmac('sha256', 'WebAppData').update(botToken).digest();
  const expectedHash = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

  if (expectedHash !== hash) return null;

  const userParam = params.get('user');
  if (!userParam) return null;

  try {
    return JSON.parse(userParam);
  } catch {
    return null;
  }
}

function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing token' });
  }
  const token = authHeader.slice(7);
  try {
    req.user = jwt.verify(token, jwtSecret);
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { verifyTelegramInitData, requireAuth };
