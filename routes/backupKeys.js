const express = require("express");
const router = express.Router();
const backupKeyController = require("../controllers/backupKeyController");

router.get("/isKey", backupKeyController.isKeyCorrect);
router.post("/newBackupKey", backupKeyController.writeNewBackupKey);

module.exports = router;
