// Orchestrates the calculation engine with persistence and the approval flow.
const { calculateQuote } = require('../engine/calculator');
const fuelService = require('./fuel.service');
const { COUNTRIES } = require('../engine/data');
const repo = require('../repositories/shipment.repository');
const prisma = require('../config/db');
const ApiError = require('../utils/ApiError');
const { makeRef } = require('../utils/ref');

// Convert a country ISO code to the DB row id.
async function countryId(code) {
  const c = await prisma.country.findUnique({ where: { code } });
  if (!c) throw new ApiError(422, `Unknown country code "${code}".`);
  return c.id;
}

// Attach the current live DHL fuel rate to the calc input.
async function withFuel(input) {
  const fuel = await fuelService.getRate();
  return { ...input, fuelRate: fuel.rate, fuelWeek: fuel.week };
}

// Stateless preview — calculates a quote without saving anything.
async function preview(input) {
  return calculateQuote(await withFuel(input));
}

async function createShipment(input, userId) {
  const quote = calculateQuote(await withFuel(input));
  if (quote.rejected) {
    // Persist the rejection so it shows in history/audit, then surface it.
    throw new ApiError(422, 'Shipment rejected by validation rules.', quote.errors);
  }

  const shipment = await repo.create({
    ref: makeRef(),
    originCountryId: await countryId(input.originCountry),
    destinationCountryId: await countryId(input.destinationCountry),
    mode: input.mode,
    dangerousGoods: input.dangerousGoods,
    remoteArea: input.remoteArea || quote.destination.remote,
    currency: input.currency || 'USD',
    status: quote.status,
    actualWeight: quote.weights.actualWeight,
    volumetricWeight: quote.weights.volumetricWeight,
    chargeableWeight: quote.weights.chargeableWeight,
    freightSubtotal: quote.freight.freightSubtotal,
    surchargeTotal: quote.surcharges.total,
    totalFreight: quote.totalFreight,
    resultJson: JSON.stringify(quote),
    inputJson: JSON.stringify(input),
    createdById: userId,
    items: { create: input.items },
    approvals: quote.approval.requiresApproval
      ? { create: { decision: 'PENDING', reason: quote.approval.reasons.join('; ') } }
      : undefined,
  });
  return { shipment, quote };
}

// Edit an existing shipment: recalculate from the corrected input and resave.
// Items are replaced; status + approval are recomputed (an edited shipment
// re-enters the approval flow rather than keeping a stale decision).
async function updateShipment(id, input, userId) {
  const existing = await repo.findById(id);
  if (!existing) throw new ApiError(404, 'Shipment not found.');

  const quote = calculateQuote(await withFuel(input));
  if (quote.rejected) {
    throw new ApiError(422, 'Shipment rejected by validation rules.', quote.errors);
  }

  const shipment = await repo.update(id, {
    originCountryId: await countryId(input.originCountry),
    destinationCountryId: await countryId(input.destinationCountry),
    mode: input.mode,
    dangerousGoods: input.dangerousGoods,
    remoteArea: input.remoteArea || quote.destination.remote,
    currency: input.currency || 'SAR',
    status: quote.status,
    actualWeight: quote.weights.actualWeight,
    volumetricWeight: quote.weights.volumetricWeight,
    chargeableWeight: quote.weights.chargeableWeight,
    freightSubtotal: quote.freight.freightSubtotal,
    surchargeTotal: quote.surcharges.total,
    totalFreight: quote.totalFreight,
    resultJson: JSON.stringify(quote),
    inputJson: JSON.stringify(input),
    // Replace items and reset the approval state.
    items: { deleteMany: {}, create: input.items },
    approvals: {
      deleteMany: {},
      ...(quote.approval.requiresApproval
        ? { create: { decision: 'PENDING', reason: quote.approval.reasons.join('; ') } }
        : {}),
    },
  });
  return { shipment, quote };
}

async function list(status) {
  return repo.findAll(status ? { status } : {});
}

async function getById(id) {
  const s = await repo.findById(id);
  if (!s) throw new ApiError(404, 'Shipment not found.');
  return s;
}

async function deleteShipment(id) {
  const s = await repo.findById(id);
  if (!s) throw new ApiError(404, 'Shipment not found.');
  await repo.remove(id);
  return { id, ref: s.ref };
}

async function decideApproval(id, decision, reason, approverId) {
  const s = await repo.findById(id);
  if (!s) throw new ApiError(404, 'Shipment not found.');
  if (s.status !== 'PENDING') {
    throw new ApiError(409, `Shipment is "${s.status}" and cannot be actioned.`);
  }
  await repo.addApproval({ shipmentId: id, decision, reason, decidedById: approverId });
  return repo.update(id, { status: decision });
}

const round2 = (n) => Math.round((n + Number.EPSILON) * 100) / 100;

async function dashboard() {
  // Single lightweight query (only the columns we actually use).
  const all = await repo.findForDashboard();
  const routeOf = (s) =>
    `${s.originCountry?.code ?? '?'} → ${s.destinationCountry?.code ?? '?'}`;

  // Total Freight KPI counts ONLY approved shipments (excludes draft/pending/rejected).
  const approved = all.filter((s) => s.status === 'APPROVED');
  const approvedTotal = approved.reduce((sum, s) => sum + (s.totalFreight || 0), 0);

  // Status counts (powers the status pie chart + KPI cards).
  const statusCounts = { DRAFT: 0, PENDING: 0, APPROVED: 0, REJECTED: 0 };
  // Freight + count per service mode (freight-by-mode pie).
  const modeMap = {};
  // Freight + count per day (freight-trend line chart).
  const trendMap = {};
  // Freight + count per route (top-routes bar chart + most-used KPI).
  const routeMap = {};

  let mostExpensive = null;

  all.forEach((s) => {
    const freight = s.totalFreight || 0;

    if (statusCounts[s.status] != null) statusCounts[s.status] += 1;

    if (!modeMap[s.mode]) modeMap[s.mode] = { mode: s.mode, value: 0, count: 0 };
    modeMap[s.mode].value += freight;
    modeMap[s.mode].count += 1;

    const day = new Date(s.createdAt).toISOString().slice(0, 10); // YYYY-MM-DD
    if (!trendMap[day]) trendMap[day] = { date: day, freight: 0, count: 0 };
    trendMap[day].freight += freight;
    trendMap[day].count += 1;

    const route = routeOf(s);
    if (!routeMap[route]) routeMap[route] = { route, count: 0, freight: 0 };
    routeMap[route].count += 1;
    routeMap[route].freight += freight;

    if (!mostExpensive || freight > (mostExpensive.totalFreight || 0)) {
      mostExpensive = s;
    }
  });

  const freightByMode = Object.values(modeMap)
    .map((m) => ({ ...m, value: round2(m.value) }))
    .sort((a, b) => b.value - a.value);

  const freightTrend = Object.values(trendMap)
    .map((d) => ({ ...d, freight: round2(d.freight) }))
    .sort((a, b) => a.date.localeCompare(b.date)); // chronological

  const topRoutes = Object.values(routeMap)
    .map((r) => ({ ...r, freight: round2(r.freight) }))
    .sort((a, b) => b.count - a.count || b.freight - a.freight)
    .slice(0, 6);

  const mostUsedRoute = topRoutes[0] || null;
  const shipmentCount = all.length;

  return {
    // KPIs
    totalFreight: round2(approvedTotal),                 // approved-only
    shipmentCount,
    avgFreight: approved.length ? round2(approvedTotal / approved.length) : 0,
    pendingApprovals: statusCounts.PENDING,
    approved: statusCounts.APPROVED,
    rejected: statusCounts.REJECTED,
    draft: statusCounts.DRAFT,
    mostUsedRoute,
    mostExpensive: mostExpensive && {
      ref: mostExpensive.ref,
      totalFreight: mostExpensive.totalFreight,
      mode: mostExpensive.mode,
      route: routeOf(mostExpensive),
    },
    // Chart datasets
    statusCounts: Object.entries(statusCounts).map(([status, count]) => ({ status, count })),
    freightByMode,
    freightTrend,
    topRoutes,
    // Recent list (kept for the table)
    history: all.slice(0, 8),
  };
}

module.exports = { preview, createShipment, updateShipment, list, getById, deleteShipment, decideApproval, dashboard };
