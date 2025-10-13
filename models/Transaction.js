const db = require("../db.js");

// Insert a new transaction
const newTransaction = async (
  recollectionCenterId,
  userId,
  emailNotificationId,
  statusCode
) => {
  const [result] = await db.query(
    `INSERT INTO transactions 
      (recollectionCenterId, createdBy, emailNotificationId, statusCode) 
      VALUES (?, ?, ?, ?)`,
    [recollectionCenterId, userId, emailNotificationId, statusCode]
  );

  // insertId = transactionId of the newly created transaction
  return result.insertId;
};
// Get all transactions
const getTransactions = async () => {
  const [rows] = await db.query("SELECT * FROM transactions");
  return rows;
};

// Get a transaction by ID
const getTransactionsByRecollectionCenterId = async (recollectionCenterId) => {
  const [rows] = await db.query(
    `SELECT
      t.transactionId,
      t.createdDate,
      rc.recollectionCenterName,
      tst.typeDescription AS statusDescription,
      tst.typeCode AS statusCode,
      COUNT(b.boxId) AS boxCount
    FROM transactions t
    INNER JOIN transactionstatustypes tst
      ON tst.typeCode = t.statusCode
    INNER JOIN boxes b
      ON b.transactionId = t.transactionId
      AND b.isDeleted = 0
    INNER JOIN recollectionCenters rc
      ON rc.recollectionCenterId = t.recollectionCenterId
      AND rc.isDeleted = 0
    WHERE t.recollectionCenterId = ? 
      AND t.isDeleted = 0
    GROUP BY t.transactionId, t.createdDate, rc.recollectionCenterName, tst.typeDescription, tst.typeCode
    `,
    [recollectionCenterId]
  );
  return rows || null;
};

const editTransactionStatusById = async (id, statusCode) => {
  const [result] = await db.query(
    `UPDATE transactions
      SET statusCode = ?
    WHERE id = ?`,
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
