const db = require("../db.js");
const {
  newTransaction,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById,
  getTransactionDetailsById
} = require("../models/Transaction");
const { newBox, getBoxesByTransactionId } = require("../models/Box");
const {
  BETHLEHEM_RECOLLECTION_CENTER_ID,
  GENDER_MAP,
  AGE_MAP,
  PENDING_STATUS_ID,
  COMPLETED_STATUS_ID,
  ADMIN_ROLE_TYPE_ID
} = require("../helpers/constants");
const { toMySQLDateTime } = require("../helpers/helpers.js");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET;
// const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configura tu archivo .env");
}

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
  const authHeader = req.headers["authorization"];
  const token = authHeader && authHeader.split(" ")[1];

  if (!token) return res.status(401).json({ message: "Access token missing" });
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    console.log(err);
    return res.status(401).json({ message: "Invalid or expired access token" });
  }

  let userId = payload.userId;
  const conn = await db.getConnection();
  await conn.beginTransaction();
  const { boxLabels } = req.body;

  // Create the transaction
  const transactionResponse = await newTransaction(
    BETHLEHEM_RECOLLECTION_CENTER_ID,
    userId,
    null,
    payload.roles.some((role) => role.roleId === ADMIN_ROLE_TYPE_ID)
      ? COMPLETED_STATUS_ID
      : PENDING_STATUS_ID,
    conn
  );
  console.log(transactionResponse);
  if (!transactionResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({
      message: "Error creating transaction."
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
  // Insert boxes
  const newBoxResponse = await newBox(
    flattenedBoxLabels,
    transactionId,
    userId,
    conn
  );
  if (!newBoxResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({
      message: "Error creating boxes."
    });
  }
  conn.commit();
  conn.release();
  res.status(201).json({
    response: { transactionId, boxes: newBoxResponse.data },
    message: "Your transaction has been made."
  });
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
  let dateTimeFormat = null;
  const { page: pageParam, selectedDay, filters = {} } = req.query;
  const recollectionCenterId = BETHLEHEM_RECOLLECTION_CENTER_ID;
  const page = Number(pageParam) || 1;
  if (selectedDay) {
    dateTimeFormat = toMySQLDateTime(selectedDay);
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
  console.log(transactionsResponse);
  if (!transactionsResponse.success) {
    return res.status(500).json({
      message: "Error fetching transactions."
    });
  }
  conn.release();
  res.json({ response: transactionsResponse.data });
}

/**
 * Updates the status of a transaction.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {number} req.body.transactionId - The ID of the transaction to update.
 * @param {string|number} req.body.statusCode - The new status code.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating success or failure.
 *
 */
async function updateTransactionStatus(req, res) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  const { transactionId, statusCode } = req.body;
  const editTransactionResponse = await editTransactionStatusById(
    transactionId,
    statusCode,
    conn
  );
  if (!editTransactionResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({
      message: "Error updating transaction status."
    });
  }
  conn.commit();
  conn.release();
  res.json({
    response: editTransactionResponse.data,
    message: "Transaction updated successfully."
  });
}

async function getTransactionDetails(req, res) {
  const conn = await db.getConnection();
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
  conn.release();
  res.json({
    response: {
      transactionDetails: transactionDetailsResponse.data,
      boxes: boxesResponse.data
    }
  });
}

module.exports = {
  writeNewTransaction,
  getTransactionsByRecollectionCenter,
  updateTransactionStatus,
  getTransactionDetails
};
