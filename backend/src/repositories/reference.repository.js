// Read access for reference data (zones, countries, rates, surcharges).
const prisma = require('../config/db');
module.exports = {
  countries: () => prisma.country.findMany({ include: { zone: true }, orderBy: { name: 'asc' } }),
  zones: () => prisma.zone.findMany({ orderBy: { code: 'asc' } }),
  rates: () => prisma.rate.findMany({ include: { zone: true }, orderBy: [{ zoneId: 'asc' }, { minKg: 'asc' }] }),
  surcharges: () => prisma.surcharge.findMany({ orderBy: { code: 'asc' } }),
  updateSurcharge: (id, data) => prisma.surcharge.update({ where: { id }, data }),
  updateRate: (id, data) => prisma.rate.update({ where: { id }, data }),
};
