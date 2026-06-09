const router = require('express').Router();
const ctrl = require('../controllers/reference.controller');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);
router.get('/countries', ctrl.countries);
router.get('/zones', ctrl.zones);
router.get('/rates', ctrl.rates);
router.get('/surcharges', ctrl.surcharges);
// Editing the rate card / surcharges is admin-only.
router.patch('/rates/:id', authorize('ADMIN'), ctrl.updateRate);
router.patch('/surcharges/:id', authorize('ADMIN'), ctrl.updateSurcharge);
module.exports = router;
