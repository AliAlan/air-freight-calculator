const prisma = require('../config/db');
module.exports = {
  findByEmail: (email) =>
    prisma.user.findUnique({ where: { email }, include: { role: true } }),
};
