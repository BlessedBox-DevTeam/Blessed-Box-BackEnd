const db = require("../db.js");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants.js");
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
const getTransactionsByRecollectionCenterId = async ({
  recollectionCenterId = BETHLEHEM_RECOLLECTION_CENTER_ID,
  page = 1,
  selectedDate,
  filterMode,
  numberOfBoxes,
  maxNumberOfBoxes,
  ageFiltersIds = [],
  genderValuesIds = [],
  conn
} = {}) => {
  const pageSize = 10;
  const offset = (page - 1) * pageSize;

  try {
    let whereClauses = [
      `t.recollectionCenterId = ${recollectionCenterId}`,
      "t.isDeleted = 0"
    ];

    // Filter by selected date
    if (selectedDate) {
      whereClauses.push(
        `t.createdDate BETWEEN '${selectedDate}' AND '${selectedDate.replace(
          "00:00:00",
          "23:59:59"
        )}'`
      );
    }
    let havingClauses = [];

    // STRICT Gender
    if (genderValuesIds.length) {
      havingClauses.push(`
    SUM(
      CASE WHEN b.genderId NOT IN (${genderValuesIds.join(",")})
           OR b.genderId IS NULL
      THEN 1 ELSE 0 END
    ) = 0
  `);
    }
    // STRICT Age
    if (ageFiltersIds.length) {
      havingClauses.push(`
    SUM(
      CASE WHEN b.boxAgeId NOT IN (${ageFiltersIds.join(",")})
           OR b.boxAgeId IS NULL
      THEN 1 ELSE 0 END
    ) = 0
  `);
    }

    // Box count conditions
    if (filterMode === "exact") {
      havingClauses.push(`COUNT(b.boxId) = ${numberOfBoxes}`);
    } else if (filterMode === "minimum") {
      havingClauses.push(`COUNT(b.boxId) >= ${numberOfBoxes}`);
    } else if (filterMode === "maximum") {
      havingClauses.push(`COUNT(b.boxId) <= ${numberOfBoxes}`);
    } else if (filterMode === "range") {
      havingClauses.push(`
    COUNT(b.boxId) BETWEEN ${numberOfBoxes} AND ${maxNumberOfBoxes}
  `);
    }

    const query = `
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
    INNER JOIN recollectioncenters rc
      ON rc.recollectionCenterId = t.recollectionCenterId
      AND rc.isDeleted = 0
    INNER JOIN boxes b
      ON b.transactionId = t.transactionId
      AND b.isDeleted = 0
    WHERE ${whereClauses.join(" AND ")}
    GROUP BY t.transactionId, t.createdDate, rc.recollectionCenterName, tst.typeDescription, tst.typeCode

    ${havingClauses.length ? "HAVING " + havingClauses.join(" AND ") : ""}
    ORDER BY t.createdDate DESC
    LIMIT ${pageSize} OFFSET ${offset};
  `;

    const [rows] = await conn.query(query);

    // Total count para paginación (sin filtro de cajas)
    const [[{ totalCount }]] = await conn.query(
      `SELECT COUNT(*) AS totalCount
        FROM 
        (
          SELECT t.transactionId
          FROM transactions t
          INNER JOIN boxes b
            ON b.transactionId = t.transactionId
            AND b.isDeleted = 0
          WHERE ${whereClauses.join(" AND ")}
          GROUP BY t.transactionId
          ${havingClauses.length ? "HAVING " + havingClauses.join(" AND ") : ""}
        ) AS filteredTransactions
      `
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
      INNER JOIN usersdetails ud
        ON ud.userId = t.createdBy
      INNER JOIN useraccount ua
        ON ua.accountId = ud.accountId
        AND ua.isDeleted = 0
      INNER JOIN recollectioncenters rc
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
