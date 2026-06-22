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
const scenarios = require('../src/engine/scenarios');
const trackingRows = require('../src/data/tracking.json');
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
  await prisma.trackedShipment.deleteMany();
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
  // Operational tracking rows (from the DHL tracking sheet). Bulk insert.
  if (trackingRows.length) {
    await prisma.trackedShipment.createMany({ data: trackingRows });
    console.log(`Tracking rows seeded: ${trackingRows.length}`);
  }

  // Demo shipments from scenarios
  let created = 0;
  for (const sc of scenarios) {
    const quote = calculateQuote(sc);
    if (quote.rejected) {
      // Store the rejected one too, so the demo shows a real REJECTED row.
      await prisma.shipment.create({
        data: {
          ref: sc.ref, mode: sc.mode, currency: sc.currency,
          dangerousGoods: sc.dangerousGoods, remoteArea: sc.remoteArea,
          status: 'REJECTED',
          originCountryId: countryByCode[sc.originCountry].id,
          destinationCountryId: countryByCode[sc.destinationCountry].id,
          createdById: users.operator.id,
          resultJson: JSON.stringify(quote),
          inputJson: JSON.stringify(sc),
          items: { create: sc.items },
          approvals: { create: { decision: 'REJECTED', reason: quote.errors.join('; ') } },
        },
      });
      created++;
      continue;
    }
    await prisma.shipment.create({
      data: {
        ref: sc.ref, mode: sc.mode, currency: sc.currency,
        dangerousGoods: sc.dangerousGoods,
        remoteArea: sc.remoteArea || quote.destination.remote,
        status: quote.status,
        originCountryId: countryByCode[sc.originCountry].id,
        destinationCountryId: countryByCode[sc.destinationCountry].id,
        actualWeight: quote.weights.actualWeight,
        volumetricWeight: quote.weights.volumetricWeight,
        chargeableWeight: quote.weights.chargeableWeight,
        freightSubtotal: quote.freight.freightSubtotal,
        surchargeTotal: quote.surcharges.total,
        totalFreight: quote.totalFreight,
        resultJson: JSON.stringify(quote),
        inputJson: JSON.stringify(sc),
        createdById: users.operator.id,
        items: { create: sc.items },
        approvals: quote.approval.requiresApproval
          ? { create: { decision: 'PENDING', reason: quote.approval.reasons.join('; ') } }
          : undefined,
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
