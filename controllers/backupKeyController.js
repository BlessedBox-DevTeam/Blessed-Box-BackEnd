const { newBackupKey, verifyKey } = require("../models/BackupKey");

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
  const newBackupKeyResponse = await newBackupKey(keyValue);
  if (!newBackupKeyResponse.success) {
    throw new Error(newBackupKeyResponse.message || "Error creating key.");
  }
  res.status(201).json({
    response: newBackupKeyResponse.data,
    message: "Key generated successfully."
  });
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
  const verifyKeyResponse = await verifyKey(keyValue);
  if (!verifyKeyResponse.success) {
    throw new Error(verifyKeyResponse.message || "Internal server error.");
  }
  res.status(201).json({
    response: Boolean(verifyKeyResponse.data),
    message: "The manual code is incorrect. Please check and try again."
  });
}

module.exports = {
  writeNewBackupKey,
  isKeyCorrect
};
