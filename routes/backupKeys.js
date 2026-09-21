const express = require("express");
const router = express.Router();
const backupKeyController = require("../controllers/backupKeyController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const { rateLimitAccessCode } = require("../middleware/accessCodeRateLimit");
const permissions = require("../helpers/constants");
const RateLimit = require("express-rate-limit");
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

router.post(
  "/isKey",
  limiter,
  authenticate,
  authorize([permissions.WRITE_TRANSACTION_PERMISSION]),
  rateLimitAccessCode,
  backupKeyController.isKeyCorrect
);

module.exports = router;
