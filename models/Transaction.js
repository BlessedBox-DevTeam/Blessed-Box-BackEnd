const db = require("../db.js");

// Insert a new transaction
const newTransaction = async (recollectionCenterId, userId, emailNotificationId, statusCode) => {
  const [result] = await db.query(
    "INSERT INTO transactions 
    (recollectionCenterId, createdBy, emailNotificationId, statusCode) 
    VALUES (?, ?, ?, ?)",
    [recollectionCenterId, userId, emailNotificationId, statusCode]
  );
  return result;
};

// Get all transactions
const getTransactions = async () => {
  const [rows] = await db.query("SELECT * FROM transactions");
  return rows;
};

// Get a transaction by ID
const getTransactionsByRecollectionCenterId = async (recollectionCenterId) => {
  const [rows] = await db.query(
    "SELECT * FROM transactions WHERE recollectionCenterId = ?",
    [recollectionCenterId]
  );
  return rows[0] || null;
};

const editTransactionStatusById = async (id, statusCode) => {
  const [result] = await db.query(
    "UPDATE transactions
      SET statusCode = ?
    WHERE id = ?",
    [statusCode, id]
  );
  return result;
};


module.exports = {
  newTransaction,
  getTransactions,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById
};
