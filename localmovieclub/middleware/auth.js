const jwt = require('jsonwebtoken');
const User = require('../models/User');

const COOKIE = 'mc_token';

function issueToken(res, user) {
  const token = jwt.sign({ sub: user._id.toString() }, process.env.JWT_SECRET, { expiresIn: '2h' });
  res.cookie(COOKIE, token, {
    httpOnly: true, // not readable by page scripts
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
    maxAge: 2 * 60 * 60 * 1000,
  });
}

async function requireAuth(req, res, next) {
  try {
    const token = req.cookies[COOKIE];
    if (!token) return res.status(401).json({ error: 'Please sign in.' });
    const { sub } = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(sub).select('-passwordHash');
    if (!user) return res.status(401).json({ error: 'Please sign in.' });
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Your session has expired. Sign in again.' });
  }
}

module.exports = { requireAuth, issueToken, COOKIE };
