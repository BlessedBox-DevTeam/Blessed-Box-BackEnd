const db = require("../db.js");
const argon2 = require("argon2");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Inserts a new backup key into the database after hashing it with Argon2.
 *
 * @param {string} keyValue - The plaintext backup key to hash and store.
 * @returns {Promise<Object>} A service object containing success status, data, and message.
 *
 * @example
 * const result = await newBackupKey("my-secret-key");
 */
const newBackupKey = async (keyValue) => {
  try {
    // Securely hash the provided key using Argon2 before storing
    const hashedKey = await argon2.hash(keyValue);

    // SQL insert query for the hashed key
    const query = `
      INSERT INTO qrbackupkeys (backupKey)
      VALUES (?)
    `;
    const [result] = await db.query(query, [hashedKey]);

    return returnServiceObject({
      success: true,
      data: result,
      message: "Backup key inserted successfully"
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error hashing or inserting backup key",
      error: error
    });
  }
};

/**
 * Retrieves all backup keys associated with a specific record ID.
 *
 * @param {number|string} id - The record ID associated with the backup key(s).
 * @returns {Promise<Object>} A service object containing the query result or error.
 *
 * @example
 * const keys = await getBackupKeyById(5);
 */
const getBackupKeyById = async (id) => {
  try {
    // Retrieve backup key(s) joined with QR codes table for active (non-deleted) records
    const [rows] = await db.query(
      `
      SELECT 
      bk.backupKey 
      FROM qrbackupkeys bk 
      INNER JOIN qrcodes qr 
      ON bk.backupKeyId = qr.backupKeyId 
      WHERE qr.qrCodeId = ? 
      AND qr.isDeleted = 0 
      AND bk.isDeleted = 0
      `,
      [id]
    );
    return returnServiceObject({
      success: true,
      data: rows
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving backup key by ID",
      error: error
    });
  }
};

/**
 * Verifies a plaintext backup key against all stored hashes using Argon2.
 *
 * @param {string} keyValue - The plaintext key entered by the user.
 * @returns {Promise<Object>} A service object containing match status and optional record data.
 *
 * @example
 * const verification = await verifyKey("my-secret-key");
 */
const verifyKey = async (keyValue) => {
  try {
    // Retrieve all non-deleted backup key hashes
    const [rows] = await db.query(
      "SELECT backupKeyId, backupKey FROM qrbackupkeys WHERE isDeleted = 0"
    );

    // Iterate through stored hashes and verify the provided key
    let matchedRecord = null;
    for (const record of rows) {
      const isMatch = await argon2.verify(record.backupKey, keyValue);
      if (isMatch) {
        matchedRecord = record;
        break;
      }
    }
    return returnServiceObject({
      success: true,
      data: matchedRecord
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error verifying backup key",
      error: error
    });
  }
};

module.exports = {
  newBackupKey,
  getBackupKeyById,
  verifyKey
};
