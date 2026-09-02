const { returnServiceObject } = require("../helpers/helpers");

const newRecollectionCenter = async (code, name, createdBy, conn) => {
  try {
    const [result] = await conn.query(
      `INSERT INTO recollection_centers 
    (code, name, created_by) 
    VALUES (?, ?, ?)
    `,
      [code, name, createdBy]
    );
    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error generating recollection center.",
      error: error
    });
  }
};

const getUserRecollectionCenter = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT 
      id, 
      name 
    FROM recollection_centers rc
    INNER JOIN user_details ud
      ON rc.id = ud.recollection_center_id
    WHERE ud.user_id = ?
      AND rc.is_active = 1`,
      [userId]
    );
    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    console.error(error);
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error finding user recollection center",
      error: error
    });
  }
};

module.exports = {
  newRecollectionCenter,
  getUserRecollectionCenter
};
