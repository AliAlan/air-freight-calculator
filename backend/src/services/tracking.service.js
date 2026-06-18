const repo = require('../repositories/tracking.repository');

// Case-insensitive list with optional status filter + free-text search.
async function list({ status, q } = {}) {
  let rows = await repo.findAll();
  if (status) rows = rows.filter((r) => r.status === status);
  if (q) {
    const needle = q.toLowerCase();
    rows = rows.filter((r) =>
      [r.supplier, r.awb, r.origin, r.destination, r.serviceType, r.invoiceNo, r.receivedBy]
        .some((v) => String(v || '').toLowerCase().includes(needle)));
  }
  return rows;
}

// Aggregates for the dashboard widget.
async function summary() {
  const rows = await repo.findAll();
  const count = (key) => {
    const m = {};
    rows.forEach((r) => { const k = (r[key] || '—').trim() || '—'; m[k] = (m[k] || 0) + 1; });
    return m;
  };
  const statusCounts = count('status');
  const byService = count('serviceType');
  const originCounts = count('origin');
  const topOrigins = Object.entries(originCounts)
    .sort((a, b) => b[1] - a[1]).slice(0, 6)
    .map(([origin, value]) => ({ origin, value }));

  const inTransit = rows.filter((r) => /transit/i.test(r.status || '')).length;
  const pending = rows.filter((r) => /pending/i.test(r.status || '')).length;
  const delivered = rows.filter((r) => /delivered/i.test(r.status || '')).length;

  return {
    total: rows.length,
    delivered,
    inTransit,
    pending,
    totalCases: rows.reduce((s, r) => s + (r.cases || 0), 0),
    totalWeight: Math.round(rows.reduce((s, r) => s + (r.chargeableWeight || 0), 0)),
    statusCounts: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    serviceCounts: Object.entries(byService).map(([serviceType, count]) => ({ serviceType, count })),
    topOrigins,
    recent: rows.slice(0, 8),
  };
}

module.exports = { list, summary };
