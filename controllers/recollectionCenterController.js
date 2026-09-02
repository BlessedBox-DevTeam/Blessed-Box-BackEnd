const db = require("../db.js");
const { newRecollectionCenter } = require("../models/RecollectionCenter");

async function writeNewRecollectionCenter(req, res) {
  const conn = await db.getConnection();
  try {
    const { code, name } = req.body;
    const { userId } = req.user;
    await newRecollectionCenter(code, name, userId, conn);
    res.status(201).json({ message: "RC generated successfully." });
  } catch (error) {
    console.error(error);
    conn.rollback();
    res.status(500).json({ error: "Error generating recollection center." });
  } finally {
    conn.release();
  }
}

module.exports = {
  writeNewRecollectionCenter
};
