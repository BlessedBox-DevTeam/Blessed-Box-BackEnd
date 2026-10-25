const express = require("express");
const router = express.Router();
const qrCodeController = require("../controllers/QRcodeController");
const { authenticate } = require("../middleware/authenticate");
const { authorize, authorizeRole } = require("../middleware/authorize");
const permissions = require("../helpers/constants");
const { MANAGER_ROLE_CODE } = permissions;
const RateLimit = require("express-rate-limit");
const limiter = RateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100
});

router.post(
  "/newQRCode",
  authenticate,
  authorize([permissions.WRITE_QR_CODE_PERMISSION]),
  qrCodeController.writeNewQRCode
);
router.post(
  "/isQRCode",
  authenticate,
  authorize([permissions.WRITE_TRANSACTION_PERMISSION]),
  qrCodeController.isQRCodeValueCorrect
);
router.get(
  "/manualAccessCode",
  limiter,
  authenticate,
  authorizeRole(MANAGER_ROLE_CODE),
  qrCodeController.getManualAccessCode
);

module.exports = router;
