require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('../models/User');

(async () => {
  const { MONGODB_URI, ADMIN_EMAIL, ADMIN_PASSWORD } = process.env;
  if (!MONGODB_URI || !ADMIN_EMAIL || !ADMIN_PASSWORD || ADMIN_PASSWORD.length < 8) {
    console.error('Set MONGODB_URI, ADMIN_EMAIL and ADMIN_PASSWORD (8+ chars) in .env first.');
    process.exit(1);
  }
  await mongoose.connect(MONGODB_URI);
  const email = ADMIN_EMAIL.toLowerCase();
  const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 12);
  await User.findOneAndUpdate(
    { email },
    { $set: { name: 'Club Admin', passwordHash, role: 'admin' } },
    { upsert: true }
  );
  console.log(`Admin ready: ${email}. Remove ADMIN_PASSWORD from .env now.`);
  await mongoose.disconnect();
})();
