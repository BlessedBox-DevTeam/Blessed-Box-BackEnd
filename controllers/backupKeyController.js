const { newBackupKey, verifyKey } = require("../models/BackupKey");
const argon2 = require("argon2");

async function writeNewBackupKey(req, res) {
  const { keyValue } = req.body;
  try {
    await newBackupKey(keyValue);
    res.status(201).json({ message: "Llave generada" });
  } catch (error) {
    res.status(500).json({ error: "Error al crear llave" });
  }
}

async function isKeyCorrect(req, res) {
  const { keyValue } = req.body;
  try {
    const isValid = await verifyKey(keyValue);
    if (isValid) {
      res.json({
        data: isValid,
        success: true,
        message: "The manual code is correct."
      });
    } else {
      res.json({
        data: isValid,
        success: true,
        message: "The manual code is incorrect. Please check and try again."
      });
    }
  } catch (error) {
    res.status(500).json({
      success: true,
      message: "Error interno del servidor",
      error: error.message
    });
  }
}

module.exports = {
  writeNewBackupKey,
  isKeyCorrect
};
