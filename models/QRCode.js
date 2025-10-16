const db = require("../db.js");
const argon2 = require("argon2");

// Insert a new QR code record
const newQRCode = async (hashedCode, backupKeyId) => {
  try {
    const [result] = await db.query(
      "INSERT INTO qrcodes (qrCode, backupKeyId) VALUES (?, ?)",
      [hashedCode, backupKeyId]
    );
    return returnServieObject({
      success: true,
      data: result
      });
  } catch (error) {
      return returnServieObject({
      success: false,
      data: null,
     message:'Error hashing or inserting QR code',
     error: error
  });
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
  try{
  const [rows] = await db.query(
    "SELECT qrcode FROM qrcodes WHERE isDeleted = 0"
  );
  for (const record of rows) {
    const isMatch = await argon2.verify(record.qrcode, codeValue);
    if (isMatch) {
      break;
    }
  }
   return returnServieObject({
      success: true,
      data: isMatch
  });
}
  catch(error){
     return returnServieObject({
      success: false,
      data: null,
     message:'Error comparing qr code',
     error: error
  });
  }
};

module.exports = {
  newQRCode,
  getQRCodes,
  getQRCodeById,
  compareQRCodeValue
};
