const db = require("../db.js");
const argon2 = require("argon2");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Inserts a new QR code record into the database.
 *
 * @param {string} code - The QR code value.
 * @param {number|string} recollectionCenterId - The ID of the associated recollection center.
 * @param {number|string} createdBy - The ID of the user who created the QR code.
 * @returns {Promise<Object>} A service object containing success status, data, and optional message.
 *
 * @example
 * const result = await newQRCode("sample-code", 1, 12);
 */
const newQRCode = async (code, recollectionCenterId, createdBy) => {
  try {
    const [result] = await db.query(
      "INSERT INTO access_codes (code, recollection_center_id, created_by) VALUES (?, ?, ?)",
      [code, recollectionCenterId, createdBy]
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
 * Retrieves a single QR code record by its ID.
 *
 * @param {number|string} recollectionCenterId - The ID of the recollection center associated with the QR code.
 * @returns {Promise<Object>} A service object containing the QR code record or null.
 *
 * @example
 * const code = await getQRCodeByRecollectionCenterId(5);
 */
const getQRCodeByRecollectionCenterId = async (recollectionCenterId) => {
  try {
    const [rows] = await db.query(
      "SELECT code FROM access_codes WHERE recollection_center_id = ?",
      [recollectionCenterId]
    );

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

module.exports = {
  newQRCode,
  getQRCodeByRecollectionCenterId
};
