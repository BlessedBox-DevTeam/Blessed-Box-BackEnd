const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Verifies a plaintext backup key against all stored hashes using Argon2.
 *
 * @param {string} keyValue - The plaintext key entered by the user.
 * @returns {Promise<Object>} A service object containing match status and optional record data.
 *
 * @example
 * const verification = await verifyKey("my-secret-key");
 */
const verifyKey = async (keyValue, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT code
       FROM access_code
       WHERE expires_at > UTC_TIMESTAMP()
       AND code = ?`,
      [keyValue]
    );
    return returnServiceObject({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error verifying backup key",
      error: error
    });
  }
};

module.exports = {
  verifyKey
};
