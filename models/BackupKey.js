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
const insert = async (keyValue, userId = null, createdAt = null) => {
  try {
    // Hash the backup key using Argon2
    const hashedKey = await argon2.hash(keyValue);

    const query = `
      INSERT INTO backup_key (key_hash, user_id, created_at)
      VALUES (?, ?, ?)
    `;

    const [result] = await db.query(query, [hashedKey, userId, createdAt]);
    return result;
  } catch (error) {
    console.error("Error hashing or inserting backup key:", error);
    throw error;
  }
};

/**
 * Get a backup key by its ID
 * @param {number} id - The backup key record id
 * @returns {Promise<object|null>}
 */
const getById = async (id) => {
  const [rows] = await db.query(
    "SELECT id, key_hash AS keyHash, user_id AS userId, created_at AS createdAt FROM backup_key WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

/**
 * Get all backup keys for a given user ID
 * @param {number} userId
 * @returns {Promise<object[]>}
 */
const getByUserId = async (userId) => {
  const [rows] = await db.query(
    "SELECT id, key_hash AS keyHash, user_id AS userId, created_at AS createdAt FROM backup_key WHERE user_id = ?",
    [userId]
  );
  return rows;
};

/**
 * Verify a plaintext key against the stored Argon2 hashes
 * @param {string} keyValue - The plaintext key to check
 * @param {number} userId - The user whose keys to check
 * @returns {Promise<object|null>} - Returns the matched record or null
 */
const verifyKey = async (keyValue, userId) => {
  const [rows] = await db.query(
    "SELECT id, key_hash AS keyHash, user_id AS userId FROM backup_key WHERE user_id = ?",
    [userId]
  );

  for (const record of rows) {
    const isMatch = await argon2.verify(record.keyHash, keyValue);
    if (isMatch) {
      return record;
    }
  }

  return null; // No match found
};

module.exports = {
  insert,
  getById,
  getByUserId,
  verifyKey
};
