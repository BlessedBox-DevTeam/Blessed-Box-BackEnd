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
  const conn = await db.getConnection();
  try {
    const { keyValue } = req.body;
    const verifyKeyResponse = await verifyKey(keyValue, conn);
    if (!verifyKeyResponse.success) {
      throw new Error(verifyKeyResponse.message || "Internal server error.");
    }
    res.status(201).json({
      response: Boolean(verifyKeyResponse.data),
      message: "The manual code is correct."
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message || "Internal server error." });
  } finally {
    conn.release();
  }
}

module.exports = {
  isKeyCorrect
};
