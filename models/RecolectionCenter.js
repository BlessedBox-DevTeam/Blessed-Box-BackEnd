const db = require("../db.js");

// Insert a new recolection center
const newRecolectionCenter = async (name, address, phone, email) => {
  const [result] = await db.query(
    "INSERT INTO recolection_center (name, address, phone, email) VALUES (?, ?, ?, ?)",
    [name, address, phone, email]
  );
  return result;
};

// Get all recolection centers
const getRecollectionCenters = async () => {
  const [rows] = await db.query("SELECT * FROM recolection_center");
  return rows;
};

// Get a recolection center by ID
const getRecolectionCenterById = async (id) => {
  const [rows] = await db.query(
    "SELECT * FROM recolection_center WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  newRecolectionCenter,
  getRecollectionCenters,
  getRecolectionCenterById
};
