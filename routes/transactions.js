const express = require("express");
const router = express.Router();
const transactionController = require("../controllers/transactionController");

router.post("/newTransaction", transactionController.writeNewTransaction);
router.post(
  "/editTransactionStatus",
  transactionController.updateTransactionStatus
);
router.get(
  "/recollectionCenterTransactions",
  transactionController.getTransactionsByRecollectionCenter
);

module.exports = router;
