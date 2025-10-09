const db = require("../db.js");

// Insert a new QR code record
const newQRCode = async (codeValue, backupKeyId) => {
  try {
    // Hash the QR value before storing
    const hashedCode = await argon2.hash(codeValue);

    const [result] = await db.query(
      "INSERT INTO qrcodes (qrCode, backupKeyId) VALUES (?, ?)",
      [hashedCode, backupKeyId]
    );

    return result;
  } catch (error) {
    console.error("Error hashing or inserting QR code:", error);
    throw error;
  }
};

// Get all QR codes
const getQRCodes = async () => {
  const [rows] = await db.query("SELECT * FROM qrcodes");
  return rows;
};

// Get QR code by ID
const getQRCodeById = async (id) => {
  const [rows] = await db.query(
    "SELECT * FROM qrcodes WHERE id = ?",
    [id]
  );
  return rows[0] || null;
};

const compareCodeValue = async (codeValue) => {
  const [rows] = await db.query(
    "SELECT * FROM qrcodes WHERE qrcode = ?",
    [codeValue]
  );
  // If there is a match, return the QR record; otherwise return null
  return rows[0] || null;
};

module.exports = {
  newQRCode,
  getQRCodes,
  getQRCodeById,
  compareCodeValue
};
