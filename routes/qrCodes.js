const express = require("express");
const router = express.Router();
const qrCodeController = require("../controllers/QRcodeController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const permissions = require("../helpers/constants");

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

module.exports = router;
