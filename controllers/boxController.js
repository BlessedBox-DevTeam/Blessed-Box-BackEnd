const db = require("../db.js");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants");
const {
  getDepositedBoxesCountByUserId,
  getBoxesCountByRecollectionCenterId
} = require("../models/Box");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;

if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
  throw new Error(
    "JWT_SECRET o JWT_REFRESH_SECRET no están definidos. Configura tu archivo .env"
  );
}

async function getUserDepositedBoxes(req, res) {
  const conn = await db.getConnection();
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing token" });

  const token = authHeader.split(" ")[1];
  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }

  const userBoxesResponse = await getDepositedBoxesCountByUserId(
    payload.userId,
    conn
  );
  if (!userBoxesResponse.success) {
    return res.status(500).json({
      message: "Internal server. Error on finding user deposited boxes"
    });
  }
  conn.release();
  res.json({
    response: userBoxesResponse.data,
    message: "User deposited boxes retrieved successfully"
  });
}
async function getBoxesCountByRecollectionCenter(req, res) {
  const conn = await db.getConnection();
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ message: "Missing token" });
  const token = authHeader.split(" ")[1];

  let payload;
  try {
    payload = jwt.verify(token, JWT_SECRET);
  } catch (err) {
    return res.status(401).json({ message: "Invalid or expired access token" });
  }

  const boxesByRCResponse = await getBoxesCountByRecollectionCenterId(
    BETHLEHEM_RECOLLECTION_CENTER_ID,
    conn
  );
  if (!boxesByRCResponse.success) {
    return res.status(500).json({
      message:
        "Internal server. Error on finding recollection center deposited boxes"
    });
  }
  conn.release();
  res.json({
    response: boxesByRCResponse.data,
    message: " Recollection center deposited boxes retrieved successfully"
  });
}
module.exports = {
  getUserDepositedBoxes,
  getBoxesCountByRecollectionCenter
};
