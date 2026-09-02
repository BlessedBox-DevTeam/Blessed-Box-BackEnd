const db = require("../db.js");
const {
  newTransaction,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById,
  getTransactionDetailsById,
  newTransactionHistory
} = require("../models/Transaction");
const { newBox, getBoxesByTransactionId } = require("../models/Box");
const {
  BETHLEHEM_RECOLLECTION_CENTER_ID,
  GENDER_MAP,
  AGE_MAP,
  PENDING_STATUS_ID,
  COMPLETED_STATUS_ID,
  MANAGER_ROLE_CODE,
  SOCKET_EVENT_NEW_TRANSACTION,
  SOCKET_EVENT_NEW_BOX_COUNT,
  SOCKET_EVENT_TRANSACTION_UPDATED
} = require("../helpers/constants");
const { toMySQLDateTimeUTC } = require("../helpers/helpers.js");
/**
 * Creates a new transaction with associated boxes.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {Array<Object>} req.body.boxLabels - Array of box label objects containing `genderId`, `boxAgeId`, and `quantity`.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating success or failure.
 *
 */
async function writeNewTransaction(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { userId, roles } = req.user;
    const { boxLabels } = req.body;

    // Create the transaction
    const transactionResponse = await newTransaction(
      BETHLEHEM_RECOLLECTION_CENTER_ID,
      userId,
      roles.some((role) => role === MANAGER_ROLE_CODE)
        ? COMPLETED_STATUS_ID
        : PENDING_STATUS_ID,
      conn
    );
    if (!transactionResponse.success) {
      return res.status(500).json({
        success: false,
        message:
          transactionResponse.message ||
          "Internal server error (transactionResponse)."
      });
    }
    const transactionId = transactionResponse.data;
    // Flatten boxes according to quantity
    const flattenedBoxLabels = boxLabels.flatMap((label) =>
      Array(label.quantity)
        .fill(0)
        .map(() => ({
          genderId: label.genderId,
          boxAgeId: label.boxAgeId
        }))
    );

    const newBoxResponse = await newBox(
      flattenedBoxLabels,
      transactionId,
      userId,
      conn
    );
    if (!newBoxResponse.success) {
      return res.status(500).json({ message: "Error creating boxes." });
    }
    await conn.commit();
    const io = req.app.get("io");
    io.to(`center:${req.user.recollectionCenterId}`).emit(
      SOCKET_EVENT_NEW_TRANSACTION
    );
    io.to(`global`).emit(SOCKET_EVENT_NEW_BOX_COUNT);

    res.status(201).json({
      response: { transactionId, boxes: newBoxResponse.data },
      message: "Your transaction has been made."
    });
  } catch (error) {
    console.error(err);
    await conn.rollback();
    return res
      .status(500)
      .json({ error: err.message || "Internal server error." });
  } finally {
    conn.release();
  }
}

/**
 * Retrieves all transactions for a specific recollection center.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.query - Query parameters.
 * @param {number} req.query.recollectionCenterId - The ID of the recollection center to filter transactions.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response with transactions or an error.
 *
 */
async function getTransactionsByRecollectionCenter(req, res) {
  const conn = await db.getConnection();
  try {
    let dateTimeFormat = null;
    const { page: pageParam, selectedDay, filters = {} } = req.query;
    const recollectionCenterId = BETHLEHEM_RECOLLECTION_CENTER_ID;
    const page = Number(pageParam) || 1;
    if (selectedDay) {
      dateTimeFormat = toMySQLDateTimeUTC(selectedDay);
    }
    const {
      ageFilters = [],
      genderValues = [],
      filterMode = null,
      numberOfBoxes = null,
      maxNumberOfBoxes = null
    } = JSON.parse(filters);

    const normalizeArray = (value) =>
      Array.isArray(value) ? value : value ? [value] : [];

    const ageFiltersList = normalizeArray(ageFilters);
    const genderValuesList = normalizeArray(genderValues);

    const ageFiltersIds = ageFiltersList.flatMap((label) =>
      Array.isArray(AGE_MAP[label])
        ? AGE_MAP[label]
        : AGE_MAP[label]
          ? [AGE_MAP[label]]
          : []
    );

    const genderValuesIds = genderValuesList.flatMap((label) =>
      Array.isArray(GENDER_MAP[label])
        ? GENDER_MAP[label]
        : GENDER_MAP[label]
          ? [GENDER_MAP[label]]
          : []
    );
    const transactionsResponse = await getTransactionsByRecollectionCenterId({
      recollectionCenterId: recollectionCenterId,
      page: page,
      selectedDate: dateTimeFormat,
      filterMode: filterMode,
      numberOfBoxes: numberOfBoxes,
      maxNumberOfBoxes: maxNumberOfBoxes,
      ageFiltersIds: ageFiltersIds,
      genderValuesIds: genderValuesIds,
      conn: conn
    });
    if (!transactionsResponse.success) {
      return res.status(500).json({
        message: "Error fetching transactions."
      });
    }
    return res.json({ response: transactionsResponse.data });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: err.message || "Internal server error." });
  } finally {
    conn.release();
  }
}

/**
 * Updates the status of a transaction.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {number} req.body.transactionId - The ID of the transaction to update.
 * @param {string|number} req.body.statusId - The new status code.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating success or failure.
 *
 */
async function updateTransactionStatus(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { transactionId, statusId } = req.body;
    const { userId } = req.user;

    const editTransactionResponse = await editTransactionStatusById(
      transactionId,
      statusId,
      userId,
      conn
    );
    if (!editTransactionResponse.success) {
      return res.status(500).json({
        message: "Error updating transaction status."
      });
    }
    const transactionHistoryResponse = await newTransactionHistory(
      transactionId,
      statusId,
      userId,
      conn
    );
    if (!transactionHistoryResponse.success) {
      return res.status(500).json({
        message: "Error inserting transaction history."
      });
    }

    await conn.commit();
    const io = req.app.get("io");
    io.to(`center:${req.user.recollectionCenterId}`).emit(
      SOCKET_EVENT_TRANSACTION_UPDATED
    );
    io.to(`global`).emit(SOCKET_EVENT_NEW_BOX_COUNT);

    return res.json({
      response: editTransactionResponse.data,
      message: "Transaction updated successfully."
    });
  } catch (error) {
    console.error(error);
    await conn.rollback();
    return res
      .status(500)
      .json({ error: err.message || "Internal server error." });
  } finally {
    conn.release();
  }
}

async function getTransactionDetails(req, res) {
  const conn = await db.getConnection();
  try {
    const transactionId = Number(req.query.transactionId);
    if (isNaN(transactionId)) {
      return res.status(400).json({
        message: "Invalid transactionId. It must be a number."
      });
    }
    const transactionDetailsResponse = await getTransactionDetailsById(
      transactionId,
      conn
    );
    if (!transactionDetailsResponse.success) {
      return res.status(500).json({
        message: "Error fetching transaction details."
      });
    }
    const boxesResponse = await getBoxesByTransactionId(transactionId, conn);
    if (!boxesResponse.success) {
      return res.status(500).json({
        message: "Error fetching boxes for transaction."
      });
    }
    return res.json({
      response: {
        transactionDetails: transactionDetailsResponse.data,
        boxes: boxesResponse.data
      }
    });
  } catch (error) {
    console.error(error);
  } finally {
    conn.release();
  }
}

module.exports = {
  writeNewTransaction,
  getTransactionsByRecollectionCenter,
  updateTransactionStatus,
  getTransactionDetails
};
