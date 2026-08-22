const {
  newQRCode,
  getQRCodeByRecollectionCenterCode
} = require("../models/QRCode");
const QRCode = require("qrcode");
const { uploadFile } = require("../s3Bucket/s3Bucket");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants");

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
  try {
    const { accessCode, RC_Code } = req.body;
    const opts = { type: "png", errorCorrectionLevel: "H", width: 300 };
    const qrBuffer = await QRCode.toBuffer(RC_Code, opts);

    await uploadFile(`RC/QR-Code/${RC_Code}`, qrBuffer, "image/png", "qrCodes");

    const { success, error } = await newQRCode(
      accessCode,
      BETHLEHEM_RECOLLECTION_CENTER_ID
    );
    if (!success) {
      return res.status(500).json({
        success: false,
        data: null,
        message: "Error creating QR code.",
        error: error
      });
    }
    res.status(201).json({
      response: true,
      message: "QR code generated successfully."
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error.",
      error: error.message
    });
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
  try {
    const { accessCode } = req.body;
    const { success, data } =
      await getQRCodeByRecollectionCenterCode(accessCode);
    if (!success) {
      return res.status(500).json({
        message: "Internal server error."
      });
    }

    if (data && data.hasExpired) {
      return res.status(400).json({
        response: false,
        message: "The QR code has expired."
      });
    }

    res.json({
      response: Boolean(data),
      message: Boolean(data)
        ? ""
        : "The QR code is incorrect. Please check and try again."
    });
  } catch (error) {
    res.status(500).json({
      message: "Internal server error.",
      error: error.message
    });
  }
}

module.exports = {
  writeNewQRCode,
  isQRCodeValueCorrect
};
