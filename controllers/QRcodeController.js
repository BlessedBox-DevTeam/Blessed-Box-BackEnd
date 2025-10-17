const { newQRCode, compareQRCodeValue } = require("../models/QRCode");
const QRCode = require("qrcode");
const argon2 = require("argon2");

/**
 * Generates a new QR code image, hashes the value, and stores it in the database.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.qrCodeValue - The plaintext value to generate the QR code.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating success or failure.
 *
 */
async function writeNewQRCode(req, res) {
  const { qrCodeValue } = req.body;

  try {
    // Generate QR image file
    await QRCode.toFile("./QR.png", qrCodeValue, {
      color: { dark: "#000", light: "#FFF" },
      width: 300
    });

    // Hash the QR value before storing in DB
    const hashedCode = await argon2.hash(qrCodeValue);
    const { success, data, message, error } = await newQRCode(hashedCode, 1); // Replace `1` with actual backupKeyId if needed

    res.status(201).json(
      returnServiceObject({
        success: true,
        data: data,
        message: "QR code generated successfully."
      })
    );
  } catch (error) {
    res.status(500).json(
      returnServiceObject({
        success: false,
        data: null,
        message: "Error creating QR code.",
        error: error.message
      })
    );
  }
}

/**
 * Verifies whether a given QR code value matches a stored hashed QR code.
 *
 * @param {Object} req - Express request object.
 * @param {Object} req.body - Request body.
 * @param {string} req.body.qrCodeValue - The QR code value to verify.
 * @param {Object} res - Express response object.
 * @returns {Promise<void>} Sends a JSON response indicating if the QR code is correct.
 *
 */
async function isQRCodeValueCorrect(req, res) {
  const { qrCodeValue } = req.body;

  const compareQRCodeResponse = await compareQRCodeValue(qrCodeValue);
  if (!compareQRCodeResponse.success) {
    return res.status(500).json({
      message: "Internal server error."
    });
  }
  res.json({
    response: Boolean(data),
    message: "The QR code is incorrect. Please check and try again."
  });
}

module.exports = {
  writeNewQRCode,
  isQRCodeValueCorrect
};
