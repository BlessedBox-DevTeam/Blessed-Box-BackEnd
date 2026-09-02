const db = require("../db.js");
const { newRecollectionCenter } = require("../models/RecollectionCenter");

async function writeNewRecollectionCenter(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();
    const { code, name } = req.body;
    const { userId } = req.user;

    const newRecollectionCenterResponse = await newRecollectionCenter(
      code,
      name,
      userId,
      conn
    );
    if (!newRecollectionCenterResponse.success) {
      throw new Error(
        newRecollectionCenterResponse.message ||
          "Error generating recollection center."
      );
    }
    await conn.commit();
    return res.status(201).json({
      response: newRecollectionCenterResponse.data,
      message: "Recollection center generated successfully."
    });
  } catch (error) {
    console.error(error);
    await conn.rollback();
    return res
      .status(500)
      .json({ error: "Error generating recollection center." });
  } finally {
    conn.release();
  }
}

module.exports = {
  writeNewRecollectionCenter
};
