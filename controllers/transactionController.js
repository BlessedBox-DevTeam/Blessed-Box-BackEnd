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
  AGE_MAP
} = require("../helpers/constants.js");
1;
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
  const { boxLabels } = req.body;
  // Create the transaction
  const transactionResponse = await newTransaction(1, 1, null, 1, conn);
  if (!transactionResponse.success) {
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
    1,
    conn
  );
  if (!newBoxResponse.success) {
    return res.status(500).json({
      message: "Error creating boxes."
    });
  }
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

  const recollectionCenterId =
    Number(req.query.recollectionCenterId) || BETHLEHEM_RECOLLECTION_CENTER_ID;
  const page = Number(req.query.page) || 1;
  const ageFilters = Array.isArray(req.query["ageFilters[]"])
    ? req.query["ageFilters[]"]
    : req.query["ageFilters[]"]
    ? [req.query["ageFilters[]"]]
    : [];
  const genderValues = Array.isArray(req.query["genderValues[]"])
    ? req.query["genderValues[]"]
    : req.query["genderValues[]"]
    ? [req.query["genderValues[]"]]
    : [];

  // Mapear a IDs
  const ageFiltersIds = ageFilters.flatMap((label) => {
    const val = AGE_MAP[label];
    return Array.isArray(val) ? val : val ? [val] : [];
  });
  const genderValuesIds = genderValues.flatMap((label) => {
    const val = GENDER_MAP[label];
    return Array.isArray(val) ? val : val ? [val] : [];
  });

  const filterMode = req.query.filterMode;
  const numberOfBoxes = req.query.numberOfBoxes
    ? Number(req.query.numberOfBoxes)
    : null;
  const maxNumberOfBoxes = req.query.maxNumberOfBoxes
    ? Number(req.query.maxNumberOfBoxes)
    : null;

  if (isNaN(recollectionCenterId)) {
    return res.status(400).json({
      message: "Invalid recollectionCenterId. It must be a number."
    });
  }
  const transactionsResponse = await getTransactionsByRecollectionCenterId(
    recollectionCenterId,
    page,
    filterMode,
    numberOfBoxes,
    maxNumberOfBoxes,
    ageFiltersIds,
    genderValuesIds,
    conn
  );
  console.log(transactionsResponse);
  if (!transactionsResponse.success) {
    return res.status(500).json({
      message: "Error fetching transactions."
    });
  }
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
  const { transactionId, statusCode } = req.body;
  const editTransactionResponse = await editTransactionStatusById(
    transactionId,
    statusCode,
    conn
  );
  if (!editTransactionResponse.success) {
    return res.status(500).json({
      message: "Error updating transaction status."
    });
  }
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
