const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants.js");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Inserts a new transaction record into the database.
 *
 * @param {number|string} recollectionCenterId - The ID of the recollection center associated with the transaction.
 * @param {number|string} userId - The ID of the user creating the transaction.
 * @param {number} statusCode - The transaction’s current status code.
 * @returns {Promise<Object>} A service object containing the success flag and new transaction ID.
 *
 * @example
 * const transaction = await newTransaction(1, 5, null, "1");
 */
const newTransaction = async (
  recollectionCenterId,
  userId,
  statusCode,
  conn
) => {
  try {
    const transactionNumberResponse = await generateTransactionNumber(conn);
    const [result] = await conn.query(
      `
      INSERT INTO transactions 
      (transaction_number, recollection_center_id, created_by, status_id) 
      VALUES (?, ?, ?, ?)
      `,
      [transactionNumberResponse.data, recollectionCenterId, userId, statusCode]
    );

    return returnServiceObject({
      success: true,
      data: {
        transactionId: result.insertId,
        transactionNumber: transactionNumberResponse.data
      }
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting new transaction",
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
const getTransactionsByRecollectionCenterId = async ({
  recollectionCenterId = BETHLEHEM_RECOLLECTION_CENTER_ID,
  page = 1,
  selectedDate,
  transactionNumber = "",
  statusIds = [],
  conn
} = {}) => {
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  try {
    const whereClauses = [
      `t.recollection_center_id = ${recollectionCenterId}`,
      "t.is_active = 1",
      "t.created_at >= MAKEDATE(YEAR(CURDATE()), 1)",
      "t.created_at < MAKEDATE(YEAR(CURDATE()) + 1, 1)"
    ];

    const queryParams = [];
    if (statusIds.length) {
      whereClauses.push(
        `t.status_id IN (${statusIds.map(() => "?").join(", ")})`
      );
      queryParams.push(...statusIds);
    }
    if (selectedDate) {
      whereClauses.push(
        "t.created_at >= ? AND t.created_at < DATE_ADD(?, INTERVAL 1 DAY)"
      );
      queryParams.push(selectedDate, selectedDate);
    }
    if (transactionNumber) {
      whereClauses.push("UPPER(t.transaction_number) LIKE ?");
      queryParams.push(`%${transactionNumber}%`);
    }

    const query = `
    SELECT
      t.id AS transactionId,
      t.created_at AS createdDate,
      ts.code AS statusCode,
      t.transaction_number AS transactionNumber,
      COUNT(b.id) AS boxCount
    FROM transactions t
    INNER JOIN transaction_status ts
      ON ts.id = t.status_id
      AND ts.is_active = 1
    INNER JOIN recollection_centers rc
      ON rc.id = t.recollection_center_id
      AND rc.is_active = 1
    INNER JOIN boxes b
      ON b.transaction_id = t.id
      AND b.is_active = 1
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY t.id, t.created_at, rc.name, ts.code, t.transaction_number

    ORDER BY t.created_at DESC
    LIMIT ? OFFSET ?;
  `;

    const [rows] = await conn.query(query, [...queryParams, pageSize, offset]);

    // Total count for pagination (without box filter)
    const [[{ totalCount }]] = await conn.query(
      `SELECT COUNT(*) AS totalCount
        FROM 
        (
          SELECT t.id
          FROM transactions t
          INNER JOIN boxes b
            ON b.transaction_id = t.id
            AND b.is_active = 1
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY t.id
        ) AS filteredTransactions
      `,
      queryParams
    );

    return returnServiceObject({
      success: true,
      data: { transactions: rows, totalCount: totalCount }
    });
  } catch (error) {
    console.error(error);
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
 * @param {string} statusId - The new status code to apply.
 * @param {string} userId - The user's id
 * @returns {Promise<Object>} A service object containing the update result or error details.
 *
 * @example
 * const result = await editTransactionStatusById(10, "COMPLETED");
 */
const editTransactionStatusById = async (id, statusId, userId, conn) => {
  try {
    const [result] = await conn.query(
      `
      UPDATE transactions
      SET status_id = ?, modified_by = ?
      WHERE transactionId = ?
      `,
      [statusId, userId, id]
    );

    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(error);
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
        t.id AS transactionId,
        t.transaction_number AS transactionNumber,
        t.created_at AS transactionDate,
        t.status_id AS statusId,
        ts.code AS statusCode,
        rc.name AS recollectionCenterName,
        ud.email,
        ud.first_name AS firstName,
        ud.last_name AS lastName
      FROM transactions t
      INNER JOIN transaction_status ts
        ON ts.id = t.status_id
      INNER JOIN user_details ud
        ON ud.id = t.created_by
      INNER JOIN recollection_centers rc
        ON rc.id = t.recollection_center_id
        AND rc.is_Active = 1
      WHERE t.id = ?
        AND t.is_Active = 1`,
      [transactionId]
    );
    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving transaction details by ID",
      error: error
    });
  }
};
const newTransactionHistory = async (transactionId, statusId, userId, conn) => {
  try {
    const [result] = await conn.query(
      `
      INSERT INTO transaction_history
      (transaction_id, status_id, modified_by) 
      VALUES (?, ?, ?)
      `,
      [transactionId, statusId, userId]
    );

    return returnServiceObject({
      success: true,
      data: result.insertId
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting new transaction",
      error: error
    });
  }
};
const generateTransactionNumber = async (conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT id 
    FROM transactions 
    ORDER BY id DESC
    LIMIT 1`
    );
    const id = rows[0]?.id ?? 0;
    return returnServiceObject({
      success: true,
      data: `BBX-${new Date().getFullYear()}-${String(id + 1).padStart(6, "0")}`
    });
  } catch (error) {
    console.error(error);
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
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById,
  getTransactionDetailsById,
  newTransactionHistory
};
