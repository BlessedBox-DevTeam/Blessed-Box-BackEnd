const db = require("../db.js");
const { returnServiceObject } = require("../helpers/helpers.js");
import { BETHLEHEM_RECOLLECTION_CENTER_ID } from "../helpers/constants.js";

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
const newBox = async (boxes, transactionId, userId) => {
  try {
    // Validate that boxes is a non-empty array
    if (!Array.isArray(boxes) || boxes.length === 0) {
      throw new Error("The 'boxes' parameter must be a non-empty array.");
    }

    // Restrict batch insert to a maximum of 100 boxes for performance and DB stability
    if (boxes.length > 100) {
      throw new Error("Cannot insert more than 100 boxes at a time.");
    }

    // Build parameter placeholders for each record: "(?, ?, ?, ?, ?, ?)"
    const placeholders = boxes.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");

    const values = boxes.flatMap((box) => [
      box?.genderId ? box.genderId : null,
      box?.boxAgeId ? box.boxAgeId : null,
      transactionId,
      BETHLEHEM_RECOLLECTION_CENTER_ID,
      box?.isSpecialOrder ? 1 : 0,
      userId
    ]);

    // SQL statement for inserting multiple records
    const query = `
      INSERT INTO boxes
      (genderId, boxAgeId, transactionId, recollectionCenterId, isSpecialOrder, createdBy)
      VALUES ${placeholders};
    `;

    const [result] = await db.query(query, values);

    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
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
const getBoxesByTransactionId = async (id) => {
  try {
    // Query database for boxes related to the given transaction ID
    const [rows] = await db.query(
      "SELECT * FROM boxes WHERE transactionId = ?",
      [id]
    );
    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error getting boxes by transactionId",
      error: error
    });
  }
};

module.exports = {
  newBox,
  getBoxesByTransactionId
};
