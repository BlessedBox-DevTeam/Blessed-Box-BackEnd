const db = require("../db.js");
const { BETHLEHEM_RECOLLECTION_CENTER_ID } = require("../helpers/constants");
const {
  getDepositedBoxesCountByUserId,
  getBoxesCountByRecollectionCenterId
} = require("../models/Box");

async function getUserDepositedBoxes(req, res) {
  const conn = await db.getConnection();
  try {
    const { userId } = req?.user;
    const userBoxesResponse = await getDepositedBoxesCountByUserId(
      userId,
      conn
    );
    if (!userBoxesResponse.success) {
      return res.status(500).json({
        message: "Internal server. Error on finding user deposited boxes"
      });
    }
    return res.json({
      response: userBoxesResponse.data,
      message: "User deposited boxes retrieved successfully"
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    conn.release();
  }
}
async function getBoxesCountByRecollectionCenter(req, res) {
  const conn = await db.getConnection();
  try {
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
    return res.json({
      response: boxesByRCResponse.data,
      message: " Recollection center deposited boxes retrieved successfully"
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    conn.release();
  }
}
module.exports = {
  getUserDepositedBoxes,
  getBoxesCountByRecollectionCenter
};
