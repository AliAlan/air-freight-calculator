// Read access for the operational tracking table.
const prisma = require('../config/db');

module.exports = {
  findAll: () => prisma.trackedShipment.findMany({ orderBy: { sn: 'desc' } }),
};
