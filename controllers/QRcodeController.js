const { newQRCode, compareQRCodeValue } = require("../models/QRCode");
const QRCode = require("qrcode");
const fs = require("fs");
const argon2 = require("argon2");

async function writeNewQRCode(req, res) {
  const { qrCodeValue } = req.body;
  //   const backupKeyId = "1";
  try {
    //  Generate Image for QR
    const generateQRImage = await QRCode.toFile("./QR.png", qrCodeValue, {
      color: { dark: "#000", light: "#FFF" },
      width: 300
    });

    // Hash the QR value before storing
    const hashedCode = await argon2.hash(qrCodeValue);

    await newQRCode(hashedCode, 1);
    res.status(201).json({ message: "QR Code generado" });
  } catch (error) {
    res.status(500).json({ error: "Error al crear QR Code" });
  }
}

async function isQRCodeValueCorrect(req, res) {
  const { qrCodeValue } = req.body;
  try {
    const isValid = await compareQRCodeValue(qrCodeValue);
    if (isValid) {
      res.json({
        data: isValid,
        success: true,
        message: "The QR code is correct."
      });
    } else {
      res.json({
        data: isValid,
        success: true,
        message: "The QR code is incorrect. Please check and try again."
      });
    }
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor.",
      error: error.message
    });
  }
}

module.exports = {
  writeNewQRCode,
  isQRCodeValueCorrect
};
