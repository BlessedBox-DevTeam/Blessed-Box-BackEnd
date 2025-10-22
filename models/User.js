const db = require("../db.js");
const { returnServiceObject } = require("../helpers/helpers.js");

const create = async (username, password, email) => {
  try {
    const [result] = await db.query(
      "INSERT INTO users (username, password, email) VALUES (?, ?, ?)",
      [username, password, email]
    );
    return returnServiceObject({
      success: true,
      data: result
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error inserting new user",
      error: error
    });
  }
};
const findByCredentials = async (email) => {
  try {
    const [rows] = await db.query(
      "SELECT passwordHash, userId, email FROM usersdetails WHERE email = ?",
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

const getUserRolesByUserId = async (userId) => {
  try {
    const [rows] = await db.query(
      `SELECT
        ar.roleTypeId AS roleId,
        rt.description AS roleName
      FROM accountroles ar
      INNER JOIN roleTypes rt
        ON rt.roleTypeId = ar.roleTypeId
        AND rt.isDeleted = 0
      INNER JOIN useraccount ua
        ON ua.accountId = ar.accountId
        AND ua.isDeleted = 0
      INNER JOIN usersDetails ud
        ON ud.accountId = ua.accountId
      WHERE ud.userId = ?`,
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

const saveRefreshToken = async (
  userId,
  refreshTokenHash,
  expiresAt,
  deviceInfo,
  ipAddress,
  conn
) => {
  try {
    const response = await conn.query(
      `INSERT INTO refreshtokens 
        (userId, refreshTokenHash, expiresAt, deviceInfo, ipAddress) 
        VALUES (?, ?, ?, ?, ?)`,
      [
        userId,
        refreshTokenHash,
        expiresAt,
        deviceInfo || null,
        ipAddress || null
      ]
    );
    return returnServiceObject({
      success: true,
      data: response
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error on inserting token",
      error: error
    });
  }
};
const getRefreshTokenByUserId = async (userId, conn) => {
  try {
    const [rows] = await conn.query(
      "SELECT * FROM refreshtokens WHERE userId = ? AND isRevoked = 0 ORDER BY createdAt DESC LIMIT 1",
      [userId]
    );
    return returnServiceObject({
      success: true,
      data: rows[0]
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error on getting refresh token",
      error: error
    });
  }
};
const revokedRefreshToken = async (userId, conn) => {
  try {
    const [row] = await conn.query(
      `UPDATE refreshtokens 
      SET isRevoked = 1
      WHERE userId = ? 
      AND isRevoked = 0`,
      [userId]
    );
    return returnServiceObject({
      success: true,
      data: row
    });
  } catch (error) {
    return returnServiceObject({
      success: false,
      data: null,
      message: "Error on deleting refresh token",
      error: error
    });
  }
};

module.exports = {
  create,
  findByCredentials,
  getUserRolesByUserId,
  saveRefreshToken,
  getRefreshTokenByUserId,
  revokedRefreshToken
};
