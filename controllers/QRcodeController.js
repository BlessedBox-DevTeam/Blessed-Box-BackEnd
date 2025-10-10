const { newQRCode, compareQRCodeValue } = require("../models/QRCode");

async function writeNewQRCode(req, res) {
  const { qrCodeValue } = req.body;
  //   const backupKeyId = "1";
  try {
    await newQRCode(qrCodeValue, 1);
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
