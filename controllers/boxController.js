const db = require("../db.js");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants");
const {
  getDepositedBoxesCountByUserId,
  getBoxesCountByRecollectionCenterId
} = require("../models/Box");

async function getUserDepositedBoxes(req, res) {
  const conn = await db.getConnection();
  const { userId } = req?.user;

  const userBoxesResponse = await getDepositedBoxesCountByUserId(userId, conn);
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
