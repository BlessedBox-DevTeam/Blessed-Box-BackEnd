const { newQRCode, compareQRCodeValue } = require("../models/QRCode");
const QRCode = require("qrcode");
const fs = require("fs");
const argon2 = require("argon2");

async function writeNewQRCode(req, res) {
  const { qrCodeValue } = req.body;
  //   const backupKeyId = "1";
  try {
    // Hash the QR value before storing
    const hashedCode = await argon2.hash(qrCodeValue);
    //  Generate Image for QR
    const generateQRImage = await QRCode.toFile("./myqr.png", hashedCode, {
      color: { dark: "#000", light: "#FFF" },
      width: 300
    });

    console.log("QR Code generated as myqr.png");

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
      res.json({ message: "QR Code es correcto" });
    } else {
      res.json({ message: "QR Code incorrecto" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error" });
  }
}

module.exports = {
  writeNewQRCode,
  isQRCodeValueCorrect
};
