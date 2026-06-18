const router = require('express').Router();
const ctrl = require('../controllers/tracking.controller');
const { authenticate } = require('../middleware/auth');

router.use(authenticate);
router.get('/summary', ctrl.summary);
router.get('/', ctrl.list);

module.exports = router;
