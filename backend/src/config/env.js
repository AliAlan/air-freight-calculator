// Centralised environment configuration with sane demo defaults.
require('dotenv').config();
module.exports = {
  port: process.env.PORT || 4000,
  jwtSecret: process.env.JWT_SECRET || 'demo-secret-change-me',
  jwtExpiry: process.env.JWT_EXPIRY || '8h',
  nodeEnv: process.env.NODE_ENV || 'development',
};
