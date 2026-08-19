const express = require("express");
const router = express.Router();
const boxController = require("../controllers/boxController");
const middleware = require("../middleware/authMiddleware");

router.get(
  "/userBoxes",
  middleware.authMiddleware,
  boxController.getUserDepositedBoxes
);
router.get(
  "/countRCBoxes",
  middleware.authMiddleware,
  boxController.getBoxesCountByRecollectionCenter
);

module.exports = router;
