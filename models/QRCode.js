const db = require("../db.js");
const argon2 = require("argon2");

// Insert a new QR code record
const newQRCode = async (hashedCode, backupKeyId) => {
  try {
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
  const [rows] = await db.query("SELECT * FROM qrcodes WHERE id = ?", [id]);
  return rows[0] || null;
};

const compareQRCodeValue = async (codeValue) => {
  const [rows] = await db.query(
    "SELECT qrcode FROM qrcodes WHERE isDeleted = 0"
  );
  for (const record of rows) {
    const isMatch = await argon2.verify(record.qrcode, codeValue);
    if (isMatch) {
      return true;
    }
  }
  return false;
};

module.exports = {
  newQRCode,
  getQRCodes,
  getQRCodeById,
  compareQRCodeValue
};
