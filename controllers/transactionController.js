const {
  newTransaction,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById
} = require("../models/Transaction");
const { newBox } = require("../models/Box");
const { returnServiceObject } = require("../helpers/helpers.js");

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
  const { boxLabels } = req.body;
  try {
    // Create the transaction
    const transactionId = await newTransaction(1, 1, null, 1);

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
    const newBoxResponse = await newBox(flattenedBoxLabels, transactionId, 1);

    res.status(201).json(
      returnServiceObject({
        success: true,
        data: { transactionId, boxes: newBoxResponse },
        message: "Your transaction has been made."
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Your transaction could not be completed.",
        error: error.message
      })
    );
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
  const recollectionCenterId = Number(req.query.recollectionCenterId);
  try {
    const response = await getTransactionsByRecollectionCenterId(
      recollectionCenterId
    );
    res.json(
      returnServiceObject({
        success: true,
        data: response,
        message: null
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Internal server error.",
        error: error.message
      })
    );
  }
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
  const { transactionId, statusCode } = req.body;
  try {
    const response = await editTransactionStatusById(transactionId, statusCode);

    res.json(
      returnServiceObject({
        success: true,
        data: response,
        message: null
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Internal server error.",
        error: error.message
      })
    );
  }
}

module.exports = {
  writeNewTransaction,
  getTransactionsByRecollectionCenter,
  updateTransactionStatus
};
