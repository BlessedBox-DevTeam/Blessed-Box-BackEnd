const db = require("../db.js");
const { verifyKey } = require("../models/BackupKey");

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
  const conn = req.dbConnection || (await db.getConnection());
  const finishAttempt = req.finishAccessCodeAttempt || (async () => {});
  const abortAttempt = req.abortAccessCodeAttempt || (async () => {});
  try {
    const { keyValue } = req.body;
    const verifyKeyResponse = await verifyKey(keyValue, conn);
    if (!verifyKeyResponse.success) {
      throw new Error(verifyKeyResponse.message || "Internal server error.");
    }
    const isCorrect = Boolean(verifyKeyResponse.data);
    await finishAttempt(isCorrect);
    res.status(201).json({
      response: isCorrect,
      message: isCorrect
        ? "The manual code is correct."
        : "The manual code is incorrect. Please check and try again."
    });
  } catch (error) {
    await abortAttempt();
    console.error(error);
    res.status(500).json({ error: error.message || "Internal server error." });
  } finally {
    if (!req.dbConnection) {
      conn.release();
    }
  }
}

module.exports = {
  isKeyCorrect
};
