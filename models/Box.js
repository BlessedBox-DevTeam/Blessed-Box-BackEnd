const db = require("../db.js");

// Insert a new box
const newBox = async (boxes) => {
  if (!Array.isArray(boxes) || boxes.length === 0) {
    throw new Error("The 'boxes' parameter must be a non-empty array.");
  }

  // Limit to 100 inserts per batch
  if (boxes.length > 100) {
    throw new Error("Cannot insert more than 100 boxes at a time.");
  }

  // Build placeholders for each record (?,?,?,?)
  const placeholders = boxes.map(() => "(?, ?, ?, ?)").join(", ");

  // Flatten the data into a single array for query parameters
  const values = boxes.flatMap(box => [
    box.name,
    box.location,
    box.status,
    box.centerId
  ]);

  const query = `
    INSERT INTO box (name, location, status, center_id)
    VALUES ${placeholders};
  `;

  const [result] = await db.query(query, values);
  return result;
};

// Get box by ID
const getBoxesById = async (id) => {
  const [rows] = await db.query("SELECT * FROM box WHERE id = ?", [id]);
  return rows[0] || null;
};

module.exports = {
  newBox,
  getBoxesById
};
