const express = require("express");
const router = express.Router();
const boxController = require("../controllers/boxController");
const { authenticate } = require("../middleware/authenticate");

router.get("/userBoxes", authenticate, boxController.getUserDepositedBoxes);
router.get(
  "/countRCBoxes",
  authenticate,
  boxController.getBoxesCountByRecollectionCenter
);

module.exports = router;
