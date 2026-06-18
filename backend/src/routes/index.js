const router = require('express').Router();
router.use('/auth', require('./auth.routes'));
router.use('/shipments', require('./shipment.routes'));
router.use('/reference', require('./reference.routes'));
router.use('/tracking', require('./tracking.routes'));
router.get('/health', (_req, res) => res.json({ success: true, status: 'ok' }));
module.exports = router;
