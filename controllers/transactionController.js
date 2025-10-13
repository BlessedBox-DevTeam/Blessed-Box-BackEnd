const {
  newTransaction,
  getTransactionsByRecollectionCenterId,
  editTransactionStatusById
} = require("../models/Transaction");
const { newBox } = require("../models/Box");

async function writeNewTransaction(req, res) {
  const { boxLabels } = req.body;
  try {
    const transactionId = await newTransaction(1, 1, null, 1);

    const flattenedBoxLabels = boxLabels.flatMap((label) =>
      Array(label.quantity)
        .fill(0)
        .map(() => ({
          genderId: label.genderId,
          boxAgeId: label.boxAgeId
        }))
    );

    const newBoxResponse = await newBox(flattenedBoxLabels, transactionId, 1);
    res.status(201).json({
      data: { transactionId: transactionId, boxes: newBoxResponse },
      success: true,
      message: "Your transaction has been made."
    });
  } catch (error) {
    res.status(500).json({
      data: null,
      success: false,
      message: "Your transaction could not be completed.",
      error: "Error en el servidor"
    });
  }
}

async function getTransactionsByRecollectionCenter(req, res) {
  const recollectionCenterId = Number(req.query.recollectionCenterId);
  try {
    const response = await getTransactionsByRecollectionCenterId(
      recollectionCenterId
    );
    res.json({
      success: true,
      data: response,
      message: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message
    });
  }
}

async function updateTransactionStatus(req, res) {
  const { transactionId, statusCode } = req.body;
  try {
    const response = await editTransactionStatusById(transactionId, statusCode);
    res.json({
      success: true,
      data: response,
      message: null
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Error interno del servidor",
      error: error.message
    });
  }
}
module.exports = {
  writeNewTransaction,
  getTransactionsByRecollectionCenter,
  updateTransactionStatus
};
