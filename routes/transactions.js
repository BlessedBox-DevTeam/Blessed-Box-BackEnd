const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const middleware = require("../middleware/authMiddleware");

router.post(
  "/newTransaction",
  middleware.authMiddleware,
  transactionController.writeNewTransaction
);
router.post(
  "/editTransactionStatus",
  middleware.authMiddleware,
  transactionController.updateTransactionStatus
);
router.get(
  "/recollectionCenterTransactions",
  middleware.authMiddleware,
  transactionController.getTransactionsByRecollectionCenter
);
router.get(
  "/transactionDetails",
  middleware.authMiddleware,
  transactionController.getTransactionDetails
);

module.exports = router;
