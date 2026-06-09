const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const env = require('../config/env');
const ApiError = require('../utils/ApiError');
const userRepo = require('../repositories/user.repository');

async function login(email, password) {
  const user = await userRepo.findByEmail(email);
  if (!user) throw new ApiError(401, 'Invalid email or password.');
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) throw new ApiError(401, 'Invalid email or password.');
  const payload = { id: user.id, email: user.email, name: user.name, role: user.role.name };
  const token = jwt.sign(payload, env.jwtSecret, { expiresIn: env.jwtExpiry });
  return { token, user: payload };
}
module.exports = { login };
