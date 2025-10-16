const db = require("../db.js");
const argon2 = require("argon2");
import { returnServiceObject } from "../helpers/helpers.js";

/**
 * Inserts a new QR code record into the database.
 *
 * @param {string} hashedCode - The Argon2-hashed QR code value.
 * @param {number|string} backupKeyId - The ID of the associated backup key.
 * @returns {Promise<Object>} A service object containing success status, data, and optional message.
 *
 * @example
 * const result = await newQRCode(hashedValue, 12);
 */
const newQRCode = async (hashedCode, backupKeyId) => {
  try {
    // Insert a new QR code record linked to a backup key
    const [result] = await db.query(
      "INSERT INTO qrcodes (qrCode, backupKeyId) VALUES (?, ?)",
      [hashedCode, backupKeyId]
    );

    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting QR code",
      error: error
    });
  }
};

/**
 * Retrieves all QR codes from the database.
 *
 * @returns {Promise<Object>} A service object containing the list of QR codes or an error.
 *
 * @example
 * const codes = await getQRCodes();
 */
const getQRCodes = async () => {
  try {
    // Query all QR code records
    const [rows] = await db.query("SELECT * FROM qrcodes");

    return returnServiceObject({
      success: true,
      data: rows
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving QR codes",
      error: error
    });
  }
};

/**
 * Retrieves a single QR code record by its ID.
 *
 * @param {number|string} id - The ID of the QR code to retrieve.
 * @returns {Promise<Object>} A service object containing the QR code record or null.
 *
 * @example
 * const code = await getQRCodeById(5);
 */
const getQRCodeById = async (id) => {
  try {
    // Fetch QR code by unique ID
    const [rows] = await db.query("SELECT * FROM qrcodes WHERE id = ?", [id]);

    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving QR code by ID",
      error: error
    });
  }
};

/**
 * Compares a plaintext QR code value against all stored hashed QR codes.
 *
 * @param {string} codeValue - The plaintext QR code value entered by the user.
 * @returns {Promise<Object>} A service object indicating whether a match was found.
 *
 * @example
 * const result = await compareQRCodeValue("user-input-code");
 */
const compareQRCodeValue = async (codeValue) => {
  try {
    // Retrieve all active (non-deleted) QR codes
    const [rows] = await db.query(
      "SELECT qrCode FROM qrcodes WHERE isDeleted = 0"
    );

    // Compare each stored hash with the provided QR code
    let isMatch = false;
    for (const record of rows) {
      const match = await argon2.verify(record.qrCode, codeValue);
      if (match) {
        isMatch = true;
        break;
      }
    }

    return returnServiceObject({
      success: true,
      data: isMatch
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error comparing QR code value",
      error: error
    });
  }
};

module.exports = {
  newQRCode,
  getQRCodes,
  getQRCodeById,
  compareQRCodeValue
};
