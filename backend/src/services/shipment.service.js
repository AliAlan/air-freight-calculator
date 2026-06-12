// Orchestrates the calculation engine with persistence and the approval flow.
const { calculateQuote } = require('../engine/calculator');
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

// Stateless preview — calculates a quote without saving anything.
function preview(input) {
  return calculateQuote(input);
}

async function createShipment(input, userId) {
  const quote = calculateQuote(input);
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
    createdById: userId,
    items: { create: input.items },
    approvals: quote.approval.requiresApproval
      ? { create: { decision: 'PENDING', reason: quote.approval.reasons.join('; ') } }
      : undefined,
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

async function dashboard() {
  const all = await repo.findAll();
  const total = all.reduce((sum, s) => sum + (s.totalFreight || 0), 0);
  const byMode = {};
  all.forEach((s) => { byMode[s.mode] = (byMode[s.mode] || 0) + (s.totalFreight || 0); });
  const mostExpensive = all.reduce(
    (max, s) => ((s.totalFreight || 0) > (max?.totalFreight || 0) ? s : max), null);
  return {
    totalFreight: Math.round(total * 100) / 100,
    shipmentCount: all.length,
    pendingApprovals: all.filter((s) => s.status === 'PENDING').length,
    approved: all.filter((s) => s.status === 'APPROVED').length,
    rejected: all.filter((s) => s.status === 'REJECTED').length,
    freightByMode: Object.entries(byMode).map(([mode, value]) => ({
      mode, value: Math.round(value * 100) / 100,
    })),
    mostExpensive: mostExpensive && {
      ref: mostExpensive.ref, totalFreight: mostExpensive.totalFreight,
    },
    history: all.slice(0, 8),
  };
}

module.exports = { preview, createShipment, list, getById, deleteShipment, decideApproval, dashboard };
