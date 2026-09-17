const db = require("../db.js");
const { returnServiceObject } = require("../helpers/helpers.js");

/**
 * Inserts a new QR code record into the database.
 *
 * @param {string} code - The QR code value.
 * @param {number|string} recollectionCenterId - The ID of the associated recollection center.
 * @returns {Promise<Object>} A service object containing success status, data, and optional message.
 *
 * @example
 * const result = await newQRCode("sample-code", 1, "2023-12-31 23:59:59");
 */
const newQRCode = async (code, recollectionCenterId, expiresAt) => {
  try {
    const [result] = await db.query(
      "INSERT INTO access_codes (code, recollection_center_id, created_at, expires_at) VALUES (?, ?, UTC_TIMESTAMP(), ?)",
      [code, recollectionCenterId, expiresAt]
    );

    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(error);
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
 * @param {number|string} recollectionCenterCode - The code of the recollection center associated with the QR code.
 * @returns {Promise<Object>} A service object containing the QR code record or null.
 *
 * @example
 * const code = await getQRCodeByRecollectionCenterCode("RC001");
 */
const getQRCodeByRecollectionCenterCode = async (recollectionCenterCode) => {
  try {
    const [rows] = await db.query(
      `SELECT 
          ac.code,
          ac.expires_at <= UTC_TIMESTAMP() AS hasExpired
       FROM access_codes ac
       INNER JOIN recollection_centers rc 
        ON  rc.id = ac.recollection_center_id 
        AND rc.is_active = 1 
       WHERE rc.code = ?
        AND ac.expires_at > UTC_TIMESTAMP()
       ORDER BY ac.expires_at DESC
       LIMIT 1`,
      [recollectionCenterCode]
    );

    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error retrieving QR code by code",
      error: error
    });
  }
};

module.exports = {
  newQRCode,
  getQRCodeByRecollectionCenterCode
};
