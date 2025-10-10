const { newBackupKey, verifyKey } = require("../models/BackupKey");
const argon2 = require("argon2");

async function writeNewBackupKey(req, res) {
  //   const { keyValue } = req.body;
  const keyValue = "12345678";
  try {
    await newBackupKey(keyValue);
    res.status(201).json({ message: "Llave generada" });
  } catch (error) {
    res.status(500).json({ error: "Error al crear llave" });
  }
}

async function isKeyCorrect(req, res) {
  //   const { keyValue } = req.body;
  const keyValue = "12345678";
  try {
    const isValid = await verifyKey(keyValue);
    if (isValid) {
      res.json({ message: "Llave es correcta" });
    } else {
      res.json({ message: "Llave incorrecta" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error" });
  }
}

module.exports = {
  writeNewBackupKey,
  isKeyCorrect
};
