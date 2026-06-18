const asyncHandler = require('../utils/asyncHandler');
const svc = require('../services/reference.service');
const fuelService = require('./../services/fuel.service');

const fuelRate = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: await fuelService.getRate() }));

const countries = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: await svc.countries() }));
const zones = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: await svc.zones() }));
const rates = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: await svc.rates() }));
const surcharges = asyncHandler(async (_req, res) =>
  res.json({ success: true, data: await svc.surcharges() }));
const updateSurcharge = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await svc.updateSurcharge(Number(req.params.id), req.body) }));
const updateRate = asyncHandler(async (req, res) =>
  res.json({ success: true, data: await svc.updateRate(Number(req.params.id), req.body) }));
module.exports = { countries, zones, rates, surcharges, fuelRate, updateSurcharge, updateRate };
