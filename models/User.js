const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants.js");
const { returnServiceObject } = require("../helpers/helpers.js");

const newUserDetails = async (
  passwordHash,
  email,
  name,
  middleName,
  lastName,
  secondLastName,
  accountId,
  conn
) => {
  try {
    const [result] = await conn.query(
      `INSERT INTO users_details 
      (email, first_name, last_name, password_hash, recollection_center_Id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        email,
        firstName,
        lastName,
        passwordHash,
        BETHLEHEM_RECOLLECTION_CENTER_ID
      ]
    );
    return returnServiceObject({
      success: true,
      data: result.insertId
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      message: "Error inserting new user",
      error: error
    });
  }
};
const newUserRole = async (accountId, roleId, conn) => {
  try {
    const [result] = await conn.query(
      `INSERT INTO user_roles 
      (role_id, user_id)
       VALUES (?, ?)`,
      [roleId, userId]
    );
    return returnServiceObject({
      success: true,
      data: result.insertId
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      message: "Error inserting new user",
      error: error
    });
  }
};
const findByCredentials = async (email, conn) => {
  try {
    const [rows] = await conn.query(
      "SELECT password_hash, id, email FROM user_details WHERE email = ? AND is_active = 1",
      [email]
    );
    return returnServiceObject({
      success: true,
      data: rows[0] || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error finding user",
      error: error
    });
  }
};

const getUserRolesByUserId = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      `SELECT
        r.code,
        r.description
      FROM user_roles ur
      INNER JOIN roles r
        ON r.id = ur.roleId
        AND r.is_active = 1
      WHERE ur.user_Id = ?
        AND ur.is_active = 1`,
      [userId]
    );
    return returnServiceObject({
      success: true,
      data: rows || null
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error finding user",
      error: error
    });
  }
};

module.exports = {
  newUserDetails,
  newUserRole,
  findByCredentials,
  getUserRolesByUserId
};
