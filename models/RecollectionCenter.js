const db = require("../db.js");

// Insert a new recollection center
const newRecollectionCenter = async (code, name, createdBy) => {
  const [result] = await db.query(
    `INSERT INTO recollection_centers 
    (code, name, created_by) 
    VALUES (?, ?, ?)
    `,
    [code, name, createdBy]
  );
  return result;
};

// Get all recollection centers
const getRecollectionCenters = async () => {
  const [rows] = await db.query(
    "SELECT code, name FROM recollection_centers WHERE is_active = 1"
  );
  return rows;
};

// Get a recollection center by Code
const getRecollectionCenterByCode = async (code) => {
  const [rows] = await db.query(
    "SELECT code, name FROM recollection_centers WHERE code = ? AND is_active = 1",
    [code]
  );
  return rows[0] || null;
};

module.exports = {
  newRecollectionCenter,
  getRecollectionCenters,
  getRecollectionCenterByCode
};
