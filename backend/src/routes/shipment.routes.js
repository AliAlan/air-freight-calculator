const router = require('express').Router();
const ctrl = require('../controllers/shipment.controller');
const validate = require('../middleware/validate');
const { authenticate, authorize } = require('../middleware/auth');
const { createShipmentSchema, quoteSchema, approvalSchema } = require('../dtos/shipment.dto');

router.use(authenticate);

router.get('/dashboard', ctrl.dashboard);
router.post('/preview', validate(quoteSchema), ctrl.preview);   // calculate, no save
router.post('/', validate(createShipmentSchema), ctrl.create);
router.get('/', ctrl.list);
router.get('/:id', ctrl.getOne);
// Only APPROVER/ADMIN may action the approval queue.
router.post('/:id/decision', authorize('APPROVER', 'ADMIN'),
  validate(approvalSchema), ctrl.decide);

module.exports = router;
