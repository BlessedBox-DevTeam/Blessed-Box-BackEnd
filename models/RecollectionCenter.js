const db = require("../db.js");

// Insert a new recollection center
const newRecollectionCenter = async (name, countryId, location, qrCodeId) => {
  const [result] = await db.query(
    `INSERT INTO recollectioncenters 
    (recollectionCenterName, countryId, location, qrCodeId) 
    VALUES (?, ?, ?, ?)
    `,
    [name, countryId, location, qrCodeId]
  );
  return result;
};

// Get all recollection centers
const getRecollectionCenters = async () => {
  const [rows] = await db.query("SELECT * FROM recollectioncenters");
  return rows;
};

// Get a recollection center by ID
const getRecollectionCenterById = async (id) => {
  const [rows] = await db.query(
    "SELECT * FROM recollectioncenters WHERE id = ? AND isDeleted = 0",
    [id]
  );
  return rows[0] || null;
};

module.exports = {
  newRecollectionCenter,
  getRecollectionCenters,
  getRecollectionCenterById
};
