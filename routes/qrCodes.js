const express = require("express");
const router = express.Router();
const qrCodeController = require("../controllers/QRcodeController");

router.post("/newQRCode", qrCodeController.writeNewQRCode);
router.post("/isQRCode", qrCodeController.isQRCodeValueCorrect);

module.exports = router;
