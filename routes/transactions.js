const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");
const { authenticate } = require("../middleware/authenticate");
const { authorize } = require("../middleware/authorize");
const permissions = require("../helpers/constants");
const RateLimit = require("express-rate-limit");
const limiter = RateLimit({
  windowMs: 60 * 1000,
  max: 60,
  keyGenerator: (req) => String(req.user.userId)
});

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
  "/userTransactions",
  authenticate,
  authorize([permissions.READ_OWN_TRANSACTION_PERMISSION]),
  limiter,
  transactionController.getUserTransactions
);
router.get(
  "/transactionDetails",
  authenticate,
  authorize([permissions.READ_TRANSACTION_PERMISSION]),
  transactionController.getTransactionDetails
);

module.exports = router;
