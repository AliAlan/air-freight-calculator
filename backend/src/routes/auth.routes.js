const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const validate = require('../middleware/validate');
const { loginSchema } = require('../dtos/auth.dto');

router.post('/login', validate(loginSchema), ctrl.login);
module.exports = router;
