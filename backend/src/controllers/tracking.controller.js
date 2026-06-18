const asyncHandler = require('../utils/asyncHandler');
const svc = require('../services/tracking.service');

const list = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.list({ status: req.query.status, q: req.query.q }) });
});
const summary = asyncHandler(async (req, res) => {
  res.json({ success: true, data: await svc.summary() });
});

module.exports = { list, summary };
