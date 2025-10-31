const express = require("express");
const router = express.Router();
const boxController = require("../controllers/boxController");

router.get("/userBoxes", boxController.getUserDepositedBoxes);

module.exports = router;
