const repo = require('../repositories/reference.repository');
module.exports = {
  countries: () => repo.countries(),
  zones: () => repo.zones(),
  rates: () => repo.rates(),
  surcharges: () => repo.surcharges(),
  updateSurcharge: (id, data) => repo.updateSurcharge(id, data),
  updateRate: (id, data) => repo.updateRate(id, data),
};
