const db = require("../db.js");

// Insert a new box
const newBox = async (boxes, userId) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    throw new Error("The 'boxes' parameter must be a non-empty array.");
  }

  // Limit to 100 inserts per batch
  if (boxes.length > 100) {
    throw new Error("Cannot insert more than 100 boxes at a time.");
  }

  // Build placeholders for each record (?,?,?,?)
  const placeholders = boxes.map(() => "(?, ?, ?, ?, ?, ?)").join(", ");

  // Flatten the data into a single array for query parameters
  const values = boxes.flatMap(box => [
    box.genderId,
    box.boxAgeId,
    box.transactionId,
    box.recollectionCenterId,
    box.isSpecialOrder ? 1 : 0
    userId,
  ]);

  const query = `
    INSERT INTO boxes (genderId, boxAgeId, transactionId, recollectionCenterId, isSpecialOrder, createdBy )
    VALUES ${placeholders};
  `;

  const [result] = await db.query(query, values);
  return result;
};

// Get box by ID
const getBoxesByTransactionId = async (id) => {
  const [rows] = await db.query("SELECT * FROM boxes WHERE transactionId = ?", [id]);
  return rows[0] || null;
};

module.exports = {
  newBox,
  getBoxesByTransactionId
};
