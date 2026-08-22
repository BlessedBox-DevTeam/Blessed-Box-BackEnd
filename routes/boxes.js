const express = require("express");
const router = express.Router();
const boxController = require("../controllers/boxController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const permissions = require("../helpers/constants");

router.get(
  "/userBoxes",
  authenticate,
  authorize([permissions.READ_OWN_TRANSACTION_PERMISSION]),
  boxController.getUserDepositedBoxes
);
router.get(
  "/countRCBoxes",
  authenticate,
  authorize([permissions.READ_RC_BOX_COUNT_PERMISSION]),
  boxController.getBoxesCountByRecollectionCenter
);

module.exports = router;
