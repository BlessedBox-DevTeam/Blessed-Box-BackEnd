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

module.exports = {
  create,
  findByCredentials
};
