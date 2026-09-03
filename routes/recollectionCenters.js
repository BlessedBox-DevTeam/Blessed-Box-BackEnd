const express = require("express");
const router = express.Router();
const recollectionCenterController = require("../controllers/recollectionCenterController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const permissions = require("../helpers/constants");

router.post(
  "/newRecollectionCenter",
  authenticate,
  authorize([permissions.WRITE_RC_PERMISSION]),
  recollectionCenterController.writeNewRecollectionCenter
);

module.exports = router;
