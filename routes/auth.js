const express = require('express');
const bcrypt = require('bcryptjs');
const User = require('../models/User');
const { requireAuth, issueToken, COOKIE } = require('../middleware/auth');

const router = express.Router();
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const str = (v) => (typeof v === 'string' ? v.trim() : '');
const publicUser = (u) => ({ id: u._id, name: u.name, email: u.email, role: u.role });

router.post('/register', async (req, res, next) => {
  try {
    const name = str(req.body.name);
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    if (!name || name.length > 60) return res.status(400).json({ error: 'Enter your name (up to 60 characters).' });
    if (!EMAIL_RE.test(email) || email.length > 120) return res.status(400).json({ error: 'Enter a valid email address.' });
    if (password.length < 8 || password.length > 72) return res.status(400).json({ error: 'Password must be 8 to 72 characters.' });
    if (await User.exists({ email })) return res.status(409).json({ error: 'That email is already registered.' });

    const user = await User.create({ name, email, passwordHash: await bcrypt.hash(password, 12) });
    issueToken(res, user);
    res.status(201).json(publicUser(user));
  } catch (e) { next(e); }
});

const DUMMY_HASH = bcrypt.hashSync('not-a-real-password', 12);

router.post('/login', async (req, res, next) => {
  try {
    const email = str(req.body.email).toLowerCase();
    const password = typeof req.body.password === 'string' ? req.body.password : '';
    const user = await User.findOne({ email });
    const ok = await bcrypt.compare(password, user ? user.passwordHash : DUMMY_HASH);
    if (!user || !ok) return res.status(401).json({ error: 'Email or password is incorrect.' });
    issueToken(res, user);
    res.json(publicUser(user));
  } catch (e) { next(e); }
});

router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE);
  res.json({ ok: true });
});

router.get('/me', requireAuth, (req, res) => res.json(publicUser(req.user)));

module.exports = router;
