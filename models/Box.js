const db = require("../db.js");

// Insert a new box
const newBox = async (name, location, status, centerId) => {
  const [result] = await db.query(
    "INSERT INTO box (name, location, status, center_id) VALUES (?, ?, ?, ?)",
    [name, location, status, centerId]
  );
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
