const db = require("../db.js");

// Insert a new transaction
const newTransaction = async (amount, type, date, userId, description) => {
  const [result] = await db.query(
    "INSERT INTO transaction (amount, type, date, user_id, description) VALUES (?, ?, ?, ?, ?)",
    [amount, type, date, userId, description]
  );
  return result;
};

// Get all transactions
const getTransactions = async () => {
  const [rows] = await db.query("SELECT * FROM transaction");
  return rows;
};

// Get a transaction by ID
const getTransactionsById = async (id) => {
  const [rows] = await db.query(
    "SELECT * FROM transaction WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

const editTransactionStatusById = async (id, status) => {
  const [result] = await db.query(
    "UPDATE transaction SET status = ? WHERE id = ?",
    [status, id]
  );
  return result;
};


module.exports = {
  newTransaction,
  getTransactions,
  getTransactionsById
};
