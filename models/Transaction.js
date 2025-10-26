const db = require("../db.js");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Inserts a new transaction record into the database.
 *
 * @param {number|string} recollectionCenterId - The ID of the recollection center associated with the transaction.
 * @param {number|string} userId - The ID of the user creating the transaction.
 * @param {number|string|null} emailNotificationId - The related email notification ID (optional).
 * @param {number} statusCode - The transaction’s current status code.
 * @returns {Promise<Object>} A service object containing the success flag and new transaction ID.
 *
 * @example
 * const transaction = await newTransaction(1, 5, null, "1");
 */
const newTransaction = async (
  recollectionCenterId,
  userId,
  emailNotificationId,
  statusCode,
  conn
) => {
  try {
    // Insert a new transaction record with provided parameters
    const [result] = await conn.query(
      `
      INSERT INTO transactions 
      (recollectionCenterId, createdBy, emailNotificationId, statusCode) 
      VALUES (?, ?, ?, ?)
      `,
      [recollectionCenterId, userId, emailNotificationId, statusCode]
    );

    return returnServiceObject({
      success: true,
      data: result.insertId
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting new transaction",
      error: error
    });
  }
};

/**
 * Retrieves all transactions from the database.
 *
 * @returns {Promise<Object>} A service object containing all transactions or an error message.
 *
 * @example
 * const transactions = await getTransactions();
 */
const getTransactions = async () => {
  try {
    const [rows] = await db.query("SELECT * FROM transactions");

    return returnServiceObject({
      success: true,
      data: rows
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving all transactions",
      error: error
    });
  }
};

/**
 * Retrieves all transactions associated with a specific recollection center.
 *
 * @param {number|string} recollectionCenterId - The recollection center ID to filter transactions.
 * @returns {Promise<Object>} A service object containing transaction summaries or an error.
 *
 * @example
 * const results = await getTransactionsByRecollectionCenterId(2);
 */
const getTransactionsByRecollectionCenterId = async (
  recollectionCenterId,
  conn,
  page = 1
) => {
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  try {
    const [rows] = await conn.query(
      `
      SELECT
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
      ORDER BY t.createdDate DESC
      LIMIT ? OFFSET ?`,
      [recollectionCenterId, pageSize, offset]
    );

    // totalCount para el frontend
    const [[{ totalCount }]] = await conn.query(
      `SELECT COUNT(*) AS totalCount
       FROM transactions
       WHERE recollectionCenterId = ? AND isDeleted = 0`,
      [recollectionCenterId]
    );

    return returnServiceObject({
      success: true,
      data: { transactions: rows, totalCount: totalCount } || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving transactions by recollection center ID",
      error: error
    });
  }
};

/**
 * Updates the status code of a specific transaction by its ID.
 *
 * @param {number|string} id - The transaction ID to update.
 * @param {string} statusCode - The new status code to apply.
 * @returns {Promise<Object>} A service object containing the update result or error details.
 *
 * @example
 * const result = await editTransactionStatusById(10, "COMPLETED");
 */
const editTransactionStatusById = async (id, statusCode, conn) => {
  try {
    // Update the transaction’s status based on its ID
    const [result] = await conn.query(
      `
      UPDATE transactions
      SET statusCode = ?
      WHERE transactionId = ?
      `,
      [statusCode, id]
    );

    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error updating transaction status",
      error: error
    });
  }
};

const getTransactionDetailsById = async (transactionId, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT
      t.transactionId,
      t.createdDate AS transactionDate,
      t.statusCode,
      rc.recollectionCenterName,
      ud.email,
      ud.name,
      ud.middleName,
      ud.lastName,
      ud.secondLastName
      FROM transactions t
      INNER JOIN usersDetails ud
        ON ud.userId = t.createdBy
      INNER JOIN useraccount ua
        ON ua.accountId = ud.accountId
        AND ua.isDeleted = 0
      INNER JOIN recollectionCenters rc
        ON rc.recollectionCenterId = t.recollectionCenterId
        AND rc.isDeleted = 0
      WHERE t.transactionId = ?
        AND t.isDeleted = 0`,
      [transactionId]
    );
    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving transaction details by ID",
      error: error
    });
  }
};
module.exports = {
  newTransaction,
  getTransactions,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById,
  getTransactionDetailsById
};
