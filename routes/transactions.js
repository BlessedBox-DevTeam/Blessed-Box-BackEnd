const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const permissions = require("../helpers/constants");

router.post(
  "/newTransaction",
  authenticate,
  authorize([permissions.WRITE_TRANSACTION_PERMISSION]),
  transactionController.writeNewTransaction
);
router.post(
  "/editTransactionStatus",
  authenticate,
  authorize([permissions.EDIT_TRANSACTION__PERMISSION]),
  transactionController.updateTransactionStatus
);
router.get(
  "/recollectionCenterTransactions",
  authenticate,
  authorize([permissions.READ_TRANSACTION_PERMISSION]),
  transactionController.getTransactionsByRecollectionCenter
);
router.get(
  "/transactionDetails",
  authenticate,
  authorize([permissions.READ_TRANSACTION_PERMISSION]),
  transactionController.getTransactionDetails
);

module.exports = router;
