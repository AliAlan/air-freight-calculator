// All database access for shipments lives here. Services never touch Prisma
// directly — this keeps the data layer swappable and easy to mock in tests.
const prisma = require('../config/db');

const include = {
  items: true,
  originCountry: true,
  destinationCountry: true,
  approvals: { orderBy: { createdAt: 'desc' } },
  createdBy: { select: { id: true, name: true, email: true } },
};

module.exports = {
  create: (data) => prisma.shipment.create({ data, include }),
  findById: (id) => prisma.shipment.findUnique({ where: { id }, include }),
  findAll: (where = {}) =>
    prisma.shipment.findMany({ where, include, orderBy: { createdAt: 'desc' } }),
  // Lightweight projection for the dashboard: only the columns the
  // KPIs/charts need, with country codes instead of full relations.
  findForDashboard: () =>
    prisma.shipment.findMany({
      select: {
        id: true, ref: true, mode: true, status: true,
        totalFreight: true, chargeableWeight: true, createdAt: true,
        originCountry: { select: { code: true, name: true } },
        destinationCountry: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
  update: (id, data) => prisma.shipment.update({ where: { id }, data, include }),
  remove: (id) => prisma.shipment.delete({ where: { id } }),
  addApproval: (data) => prisma.approval.create({ data }),
  countByStatus: (status) => prisma.shipment.count({ where: { status } }),
};
