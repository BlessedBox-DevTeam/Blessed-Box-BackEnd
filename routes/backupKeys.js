const express = require("express");
const router = express.Router();
const backupKeyController = require("../controllers/backupKeyController");

router.post("/isKey", backupKeyController.isKeyCorrect);

module.exports = router;
