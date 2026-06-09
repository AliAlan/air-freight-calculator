const asyncHandler = require('../utils/asyncHandler');
const svc = require('../services/shipment.service');

const preview = asyncHandler(async (req, res) => {
  res.json({ success: true, data: svc.preview(req.body) });
});
const create = asyncHandler(async (req, res) => {
  const data = await svc.createShipment(req.body, req.user.id);
  res.status(201).json({ success: true, data });
});
const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.list(req.query.status) });
});
const getOne = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.getById(Number(req.params.id)) });
});
const decide = asyncHandler(async (req, res) => {
  const { decision, reason } = req.body;
  const data = await svc.decideApproval(Number(req.params.id), decision, reason, req.user.id);
  res.json({ success: true, data });
});
const dashboard = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.dashboard() });
});
module.exports = { preview, create, list, getOne, decide, dashboard };
