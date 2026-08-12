const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants.js");
const { returnServiceObject } = require("../helpers/helpers.js");

const newUserDetails = async (passwordHash, email, name, lastName, conn) => {
  try {
    const [result] = await conn.query(
      `INSERT INTO user_details 
      (email, first_name, last_name, password_hash, recollection_center_Id, is_active)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [email, name, lastName, passwordHash, BETHLEHEM_RECOLLECTION_CENTER_ID, 0]
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
const newUserRole = async (userId, roleId, conn) => {
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
      "SELECT password_hash AS passwordHash, id AS userId, email FROM user_details WHERE email = ? AND is_active = 1",
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

const findByEmail = async (email, conn) => {
  try {
    const [rows] = await conn.query(
      "SELECT id AS userId, email, first_name AS firstName, last_name AS lastName, is_active FROM user_details WHERE email = ?",
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

const activateUser = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      `UPDATE user_details
       SET is_active = 1
       WHERE id = ?`,
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
      message: "Error activating user",
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
        ON r.id = ur.role_id
        AND r.is_active = 1
      WHERE ur.user_id = ?
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
const updateLastLogin = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      `UPDATE user_details
       SET last_login_at = NOW()
       WHERE id = ?`,
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
      message: "Error updating last login",
      error: error
    });
  }
};

module.exports = {
  newUserDetails,
  newUserRole,
  findByCredentials,
  getUserRolesByUserId,
  updateLastLogin,
  findByEmail,
  activateUser
};
