const { returnServiceObject } = require("../helpers/helpers.js");
const {
  COMPLETED_STATUS_ID,
  FEMALE_GENDER_ID,
  MALE_GENDER_ID,
  UNLABELED_GENDER_ID
} = require("../helpers/constants.js");

/**
 *
 * Each box entry includes gender, age group, transaction reference, recollection center,
 * special order flag, and creator user ID.
 *
 * @param {Array<Object>} boxes - Array of box objects to insert.
 * @param {number|string} transactionId - The transaction ID associated with the boxes.
 * @param {number|string} userId - The ID of the user creating the boxes.
 * @returns {Promise<Object>} A service object containing the success flag, data, or error.
 *
 * @example
 * const result = await newBox([{ genderId: 1, boxAgeId: 2 }], 101, 5);
 */
const newBox = async (boxes, transactionId, userId, conn) => {
  try {
    // Validate that boxes is a non-empty array
    if (!Array.isArray(boxes) || boxes.length === 0) {
      throw new Error("The 'boxes' parameter must be a non-empty array.");
    }
    // Restrict batch insert to a maximum of 100 boxes for performance and DB stability
    if (boxes.length > 100) {
      throw new Error("Cannot insert more than 100 boxes at a time.");
    }
    const placeholders = boxes.map(() => "(?, ?, ?, ?)").join(", ");

    const values = boxes.flatMap((box) => [
      box?.genderId ? box.genderId : null,
      box?.boxAgeId ? box.boxAgeId : null,
      transactionId,
      userId
    ]);

    const query = `
      INSERT INTO boxes
      (gender_id, age_id, transaction_id, created_by)
      VALUES ${placeholders};
    `;
    const [result] = await conn.query(query, values);
    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting new box",
      error: error
    });
  }
};

/**
 * Retrieves boxes by their associated transaction ID.
 *
 * @param {number|string} id - The transaction ID used to find boxes.
 * @returns {Promise<Object>} A service object containing the success flag, data, or error.
 *
 * @example
 * const boxes = await getBoxesByTransactionId(101);
 */
const getBoxesByTransactionId = async (id, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT
       b.id AS boxId,
       g.code AS genderCode,
       ba.code AS ageCode
      FROM boxes b
      LEFT JOIN box_ages ba
        ON ba.id = b.age_id
        AND ba.is_active = 1
      INNER JOIN genders g
        ON g.id = b.gender_id
        AND g.is_active = 1
      WHERE b.transaction_id = ?`,
      [id]
    );
    return returnServiceObject({
      success: true,
      data: rows
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error getting boxes by transactionId",
      error: error
    });
  }
};
const getDepositedBoxesCountByUserId = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT
        COUNT(b.id) AS totalBoxes,
        SUM(CASE WHEN b.gender_id = ? THEN 1 ELSE 0 END) AS femaleBoxes,
        SUM(CASE WHEN b.gender_id = ? THEN 1 ELSE 0 END) AS maleBoxes,
        SUM(CASE WHEN b.gender_id = ? THEN 1 ELSE 0 END) AS unlabeledBoxes
      FROM boxes b
      INNER JOIN transactions t
        ON t.id = b.transaction_id
        AND t.is_active = 1
        AND t.status_id = ?
        AND t.created_by = ?`,
      [
        FEMALE_GENDER_ID,
        MALE_GENDER_ID,
        UNLABELED_GENDER_ID,
        COMPLETED_STATUS_ID,
        userId
      ]
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
      message: "Error getting boxes by userId",
      error: error
    });
  }
};
const getBoxesCountByRecollectionCenterId = async (
  recollectionCenterId,
  conn
) => {
  try {
    const [rows] = await conn.query(
      `SELECT
        COUNT(b.id) AS totalBoxes
      FROM boxes b
      INNER JOIN transactions t
        ON t.id = b.transaction_id
        AND t.is_active = 1
        AND t.status_id = ?
      WHERE t.recollection_center_id = ?`,
      [COMPLETED_STATUS_ID, recollectionCenterId]
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
      message: "Error getting boxes by recollectionCenterId",
      error: error
    });
  }
};

module.exports = {
  newBox,
  getBoxesByTransactionId,
  getDepositedBoxesCountByUserId,
  getBoxesCountByRecollectionCenterId
};
