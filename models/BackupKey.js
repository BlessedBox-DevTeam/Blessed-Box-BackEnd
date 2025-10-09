// models/backupKey.js
const db = require("../db.js");
const argon2 = require("argon2");

/**
 * Insert a new backup key (hashed with Argon2)
 * @param {string} keyValue - The plaintext backup key to hash and store
 * @param {number|null} userId - Optional: related user id
 * @param {Date|string|null} createdAt - Optional creation timestamp (defaults to NOW() in DB if null)
 * @returns {Promise<object>} - Result of the insert query
 */
const insert = async (keyValue) => {
  try {
    // Hash the backup key using Argon2
    const hashedKey = await argon2.hash(keyValue);

    const query = `
      INSERT INTO qrbackupkeys (backupKey)
      VALUES (?)
    `;

    const [result] = await db.query(query, [hashedKey]);
    return result;
  } catch (error) {
    console.error("Error hashing or inserting backup key:", error);
    throw error;
  }
};

/**
 * Get all backup keys for a given ID
 * @param {number} Id
 * @returns {Promise<object[]>}
 */
const getBackupKeyById = async (id) => {
  const [rows] = await db.query(
    "SELECT backupKey
    FROM qrbackupkeys bk
    INNER JOIN qrcodes qr
      ON bk.backupKeyId = qr.backupKeyId
      AND qr.isDeleted = 0
    WHERE = ?
      AND bk.isDeleted = 0",
    [id]
  );
  return rows;
};


const argon2 = require("argon2");
const db = require("../db.js");

/**
 * Verify a plaintext backup key entered by user
 * @param {string} keyValue - Plaintext key entered by user
 * @returns {Promise<object|null>} - Returns matched record or null
 */
const verifyKey = async (keyValue) => {
  try {
    // Get all backup key hashes for this user (or all if you prefer)
    const [rows] = await db.query(
      "SELECT
      backupKeyId,
      backupKey,
      FROM qrbackupkeys
      WHERE isDeleted = 0",
    );

    // Compare entered key with each stored hash
    for (const record of rows) {
      const isMatch = await argon2.verify(record.backupKey, keyValue);
      if (isMatch) {
        return record; // Return the matched record
      }
    }

    // No matches found
    return null;
  } catch (error) {
    console.error("Error verifying backup key:", error);
    throw error;
  }
};

module.exports = {
  insert,
  getBackupKeyById,
  verifyKey
};
