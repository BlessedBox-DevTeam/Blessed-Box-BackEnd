const { newBackupKey, verifyKey } = require("../models/BackupKey");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Creates a new backup key and stores it in the database.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.keyValue - The value of the backup key to store.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating the operation result.
 *
 */
async function writeNewBackupKey(req, res) {
  const { keyValue } = req.body;
  try {
    await newBackupKey(keyValue);
    res.status(201).json(
      returnServiceObject({
        success: true,
        data: null,
        message: "Key generated successfully."
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Error creating key.",
        error
      })
    );
  }
}

/**
 * Verifies whether a provided backup key matches the stored hashed key.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.keyValue - The value of the key to verify.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating whether the key is valid.
 *
 */
async function isKeyCorrect(req, res) {
  const { keyValue } = req.body;
  try {
    const { success, data } = await verifyKey(keyValue);
    const message = data
      ? "The manual code is correct."
      : "The manual code is incorrect. Please check and try again.";
    res.json(
      returnServiceObject({
        success: true,
        data: Boolean(data),
        message
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Internal server error.",
        error
      })
    );
  }
}

module.exports = {
  writeNewBackupKey,
  isKeyCorrect
};
