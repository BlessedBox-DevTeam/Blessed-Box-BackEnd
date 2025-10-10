const express = require("express");
const router = express.Router();
const recollectionCenterController = require("../controllers/recollectionCenterController");

router.get(
  "/userRecollectionCenter",
  recollectionCenterController.getUserRecollectionCenter
);
router.post(
  "/newRecollectionCenter",
  recollectionCenterController.writeNewRecollectionCenter
);

module.exports = router;
