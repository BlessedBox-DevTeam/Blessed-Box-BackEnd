const {
  newQRCode,
  getQRCodeByRecollectionCenterCode
} = require("../models/QRCode");
const QRCode = require("qrcode");
const crypto = require("crypto");
const { uploadFile } = require("../s3Bucket/s3Bucket");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants");

const ACCESS_CODE_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
const ACCESS_CODE_LENGTH = 6;

function generateAccessCode() {
  const randomBytes = crypto.randomBytes(ACCESS_CODE_LENGTH);

  return Array.from(
    randomBytes,
    (byte) => ACCESS_CODE_ALPHABET[byte % ACCESS_CODE_ALPHABET.length]
  ).join("");
}

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
    const { RC_Code } = req.body;
    const accessCode = generateAccessCode();
    const opts = { type: "png", errorCorrectionLevel: "H", width: 300 };
    const qrBuffer = await QRCode.toBuffer(RC_Code, opts);

    await uploadFile(`RC/QR-Code/${RC_Code}`, qrBuffer, "image/png", "qrCodes");

    console.log(accessCode);

    const { success, error } = await newQRCode(
      accessCode,
      BETHLEHEM_RECOLLECTION_CENTER_ID
    );
    if (!success) {
      throw new Error(error?.message || error || "Error creating QR code.");
    }
    res.status(201).json({
      response: true,
      message: "QR code generated successfully.",
      accessCode
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
      throw new Error("Internal server error.");
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
