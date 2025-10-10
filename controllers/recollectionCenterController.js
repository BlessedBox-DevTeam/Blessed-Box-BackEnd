const {
  newRecollectionCenter,
  getRecollectionCenterById
} = require("../models/RecollectionCenter");

async function writeNewRecollectionCenter(req, res) {
  const { name, countryId, location } = req.body;
  try {
    await newRecollectionCenter(name, countryId, location, 1);
    res.status(201).json({ message: "Centro generado exitosamente" });
  } catch (error) {
    res.status(500).json({ error: "Error al genere centro" });
  }
}

async function getUserRecollectionCenter(req, res) {
  const { recollectionCenterId } = req.body;
  try {
    const isValid = await getRecollectionCenterById(recollectionCenterId);
    if (isValid) {
      res.json({ message: "Centro de usuario encontrado" });
    } else {
      res.json({ message: "Centro no encontrado" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error" });
  }
}

module.exports = {
  writeNewRecollectionCenter,
  getUserRecollectionCenter
};
