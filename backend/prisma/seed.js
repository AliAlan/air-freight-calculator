/**
 * seed.js — Populates the database with reference data, demo users, and the
 * five sample shipments (each calculated through the real engine).
 *
 * Run with:  npm run seed   (or  npm run setup  to also create the schema)
 *
 * Demo logins (all use password: demo1234):
 *   admin@afcc.demo    -> ADMIN     (full access incl. rate/surcharge editing)
 *   operator@afcc.demo -> OPERATOR  (create shipments)
 *   approver@afcc.demo -> APPROVER  (approve/reject pending shipments)
 */
const bcrypt = require('bcryptjs');
const prisma = require('../src/config/db');
const {
  ZONES, COUNTRIES, RATE_BRACKETS, RATE_GRID, SURCHARGES,
} = require('../src/engine/data');
const demoShipments = require('../src/engine/demoShipments');
const { calculateQuote } = require('../src/engine/calculator');
const { makeRef } = require('../src/utils/ref');

async function clear() {
  // Order matters because of foreign keys.
  await prisma.approval.deleteMany();
  await prisma.shipmentItem.deleteMany();
  await prisma.shipment.deleteMany();
  await prisma.rate.deleteMany();
  await prisma.country.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.surcharge.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.user.deleteMany();
  await prisma.role.deleteMany();
}

async function main() {
  console.log('Seeding database...');
  await clear();

  // Roles + users
  const roleNames = ['ADMIN', 'OPERATOR', 'APPROVER'];
  const roles = {};
  for (const name of roleNames) {
    roles[name] = await prisma.role.create({ data: { name } });
  }
  const hash = await bcrypt.hash('demo1234', 10);
  const users = {};
  users.admin = await prisma.user.create({ data: { email: 'admin@afcc.demo', name: 'Avery Admin', password: hash, roleId: roles.ADMIN.id } });
  users.operator = await prisma.user.create({ data: { email: 'operator@afcc.demo', name: 'Omar Operator', password: hash, roleId: roles.OPERATOR.id } });
  users.approver = await prisma.user.create({ data: { email: 'approver@afcc.demo', name: 'Priya Approver', password: hash, roleId: roles.APPROVER.id } });

  // Zones
  const zoneByCode = {};
  for (const z of ZONES) {
    zoneByCode[z.code] = await prisma.zone.create({ data: { code: z.code, name: z.name, factor: z.factor } });
  }
  // Countries
  const countryByCode = {};
  for (const c of COUNTRIES) {
    countryByCode[c.code] = await prisma.country.create({
      data: { code: c.code, name: c.name, remote: c.remote, zoneId: zoneByCode[c.zone].id },
    });
  }
  // Rates — REAL per-zone DHL Import Express card from RATE_GRID (SAR).
  // perKg column stores the per-0.5kg incremental rate; the 0–0.5kg row
  // carries the flat first-half-kg minimum. (Blueprint V2.)
  for (const z of ZONES) {
    const grid = RATE_GRID[z.code];
    await prisma.rate.create({ data: { zoneId: zoneByCode[z.code].id, minKg: 0, maxKg: 0.5, perKg: 0, minCharge: grid.firstHalf } });
    let prev = 0.5;
    for (const band of grid.perHalfKg) {
      const upper = band.upTo === null ? 99999 : band.upTo;
      await prisma.rate.create({ data: { zoneId: zoneByCode[z.code].id, minKg: prev, maxKg: upper, perKg: band.rate, minCharge: 0 } });
      prev = upper;
    }
  }
  // Surcharges
  for (const s of SURCHARGES) {
    await prisma.surcharge.create({ data: { code: s.code, name: s.name, type: s.type, value: s.value, condition: s.condition, active: s.active !== false } });
  }
  // Demo shipments (~50, generated) — varied origins, modes, weights, dates
  // and statuses so the dashboard + details show a full, realistic picture.
  // Each stores inputJson, so they are all editable.
  let created = 0;
  const DAY = 86400000;
  for (const d of demoShipments) {
    const quote = calculateQuote(d.input);
    const createdAt = new Date(Date.now() - d.daysAgo * DAY);
    const base = {
      ref: d.ref,
      mode: d.input.mode,
      currency: d.input.currency || 'SAR',
      dangerousGoods: !!d.input.dangerousGoods,
      originCountryId: countryByCode[d.input.originCountry].id,
      destinationCountryId: countryByCode[d.input.destinationCountry].id,
      createdById: users.operator.id,
      inputJson: JSON.stringify(d.input),
      resultJson: JSON.stringify(quote),
      items: { create: d.input.items },
      createdAt,
    };

    if (quote.rejected) {
      await prisma.shipment.create({
        data: {
          ...base, status: 'REJECTED',
          approvals: { create: { decision: 'REJECTED', reason: quote.errors.join('; '), decidedById: users.approver.id } },
        },
      });
      created++;
      continue;
    }

    // Approval record matches the assigned status.
    let approvals;
    if (d.status === 'APPROVED') {
      approvals = { create: { decision: 'APPROVED', reason: 'Approved', decidedById: users.approver.id } };
    } else if (d.status === 'REJECTED') {
      approvals = { create: { decision: 'REJECTED', reason: 'Rejected by approver', decidedById: users.approver.id } };
    } else if (d.status === 'PENDING') {
      approvals = { create: { decision: 'PENDING', reason: (quote.approval.reasons[0] || 'Pending review') } };
    } else {
      approvals = undefined; // DRAFT
    }

    await prisma.shipment.create({
      data: {
        ...base,
        remoteArea: quote.destination.remote,
        status: d.status,
        actualWeight: quote.weights.actualWeight,
        volumetricWeight: quote.weights.volumetricWeight,
        chargeableWeight: quote.weights.chargeableWeight,
        freightSubtotal: quote.freight.freightSubtotal,
        surchargeTotal: quote.surcharges.total,
        totalFreight: quote.totalFreight,
        approvals,
      },
    });
    created++;
  }

  await prisma.auditLog.create({
    data: { actor: 'system', action: 'SEED', entity: 'database', meta: `${created} shipments` },
  });

  console.log(`Done. Users: 3, Zones: ${ZONES.length}, Countries: ${COUNTRIES.length}, Shipments: ${created}`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
