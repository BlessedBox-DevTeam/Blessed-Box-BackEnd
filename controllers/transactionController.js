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
  DECLINED_STATUS_ID,
  MANAGER_ROLE_CODE,
  SOCKET_EVENT_NEW_TRANSACTION,
  SOCKET_EVENT_NEW_BOX_COUNT,
  SOCKET_EVENT_TRANSACTION_UPDATED
} = require("../helpers/constants");
const { sendTransactionConfirmation } = require("../sqs/SQS.js");
const { toMySQLDateTimeUTC } = require("../helpers/helpers.js");

const TRANSACTION_STATUS_FILTERS = {
  pendiente: PENDING_STATUS_ID,
  pending: PENDING_STATUS_ID,
  completado: COMPLETED_STATUS_ID,
  completed: COMPLETED_STATUS_ID,
  decline: DECLINED_STATUS_ID,
  declined: DECLINED_STATUS_ID
};

const formatTransactionNumber = (transactionNumber) => {
  const normalizedNumber = String(transactionNumber ?? "").trim();

  return /^\d+$/.test(normalizedNumber)
    ? normalizedNumber.padStart(6, "0")
    : normalizedNumber.toUpperCase();
};

function getBoxesByGender(gender, ageCounts) {
  const genderId = GENDER_MAP[gender];
  if (!genderId || !ageCounts || typeof ageCounts !== "object") {
    throw new Error(`Invalid gender group: ${gender}.`);
  }

  return Object.entries(ageCounts).flatMap(([age, quantity]) => {
    const boxAgeId = AGE_MAP[age];
    if (!boxAgeId || !Number.isInteger(quantity) || quantity < 0) {
      throw new Error(`Invalid quantity or age group: ${age}.`);
    }

    return Array.from({ length: quantity }, () => ({ genderId, boxAgeId }));
  });
}

/**
 * Creates a new transaction with associated boxes.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {Object} req.body.boxLabels - Box quantities grouped by gender and age.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating success or failure.
 *
 */
async function writeNewTransaction(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { userId, roles, email } = req.user;
    const { boxLabels = {} } = req.body;

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
      throw new Error(
        transactionResponse.message ||
          "Internal server error (transactionResponse)."
      );
    }
    const { transactionId, transactionNumber } = transactionResponse.data;
    const insertedBoxes = [];

    for (const [gender, ageCounts] of Object.entries(boxLabels)) {
      const boxes = getBoxesByGender(gender, ageCounts);
      if (boxes.length === 0) continue;

      const newBoxResponse = await newBox(boxes, transactionId, userId, conn);
      if (!newBoxResponse.success) {
        throw new Error(newBoxResponse.message || "Error creating boxes.");
      }
      insertedBoxes.push(newBoxResponse.data);
    }
    if (insertedBoxes.length === 0) {
      throw new Error("The transaction must contain at least one box.");
    }

    await conn.commit();
    const io = req.app.get("io");
    io.to(`center:${req.user.recollectionCenterId}`).emit(
      SOCKET_EVENT_NEW_TRANSACTION
    );
    io.to(`global`).emit(SOCKET_EVENT_NEW_BOX_COUNT);

    await sendTransactionConfirmation({
      email: email,
      transactionNumber: transactionNumber
    });

    res.status(201).json({
      response: { transactionId: transactionId, boxes: insertedBoxes },
      message: "Your transaction has been made."
    });
  } catch (error) {
    console.error(error);
    await conn.rollback();
    return res
      .status(500)
      .json({ error: error.message || "Internal server error." });
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
    const {
      page: pageParam,
      selectedDay,
      transactionNumber = "",
      filters = {}
    } = req.query;
    const recollectionCenterId = BETHLEHEM_RECOLLECTION_CENTER_ID;
    const page = Number(pageParam) || 1;
    const selectedDate = selectedDay
      ? toMySQLDateTimeUTC(selectedDay)
      : undefined;
    const parsedFilters =
      typeof filters === "string" ? JSON.parse(filters) : filters;
    const statusCodes = parsedFilters.statusCodes ?? [];

    const normalizeArray = (value) =>
      Array.isArray(value) ? value : value ? [value] : [];

    const statusIds = normalizeArray(statusCodes).flatMap((statusCode) => {
      const statusId =
        TRANSACTION_STATUS_FILTERS[String(statusCode).toLowerCase()];
      return statusId ? [statusId] : [];
    });
    const transactionsResponse = await getTransactionsByRecollectionCenterId({
      recollectionCenterId: recollectionCenterId,
      page: page,
      selectedDate: selectedDate,
      transactionNumber: formatTransactionNumber(transactionNumber),
      statusIds: [...new Set(statusIds)],
      conn: conn
    });
    if (!transactionsResponse.success) {
      throw new Error(
        transactionsResponse.message || "Error fetching transactions."
      );
    }
    return res.json({ response: transactionsResponse.data });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error." });
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
      throw new Error(
        editTransactionResponse.message || "Error updating transaction status."
      );
    }
    const transactionHistoryResponse = await newTransactionHistory(
      transactionId,
      statusId,
      userId,
      conn
    );
    if (!transactionHistoryResponse.success) {
      throw new Error(
        transactionHistoryResponse.message ||
          "Error inserting transaction history."
      );
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
      .json({ error: error.message || "Internal server error." });
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
      throw new Error(
        transactionDetailsResponse.message ||
          "Error fetching transaction details."
      );
    }
    const boxesResponse = await getBoxesByTransactionId(transactionId, conn);
    if (!boxesResponse.success) {
      throw new Error(
        boxesResponse.message || "Error fetching boxes for transaction."
      );
    }
    return res.json({
      response: {
        transactionDetails: transactionDetailsResponse.data,
        boxes: boxesResponse.data
      }
    });
  } catch (error) {
    console.error(error);
    return res
      .status(500)
      .json({ error: error.message || "Internal server error." });
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
