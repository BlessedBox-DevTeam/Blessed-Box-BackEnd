const express = require("express");
const router = express.Router();
const event = require("../controllers/eventController");

// Aquí puedes agregar rutas en el futuro
router.post("/home", event.login);
module.exports = router;
