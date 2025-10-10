const express = require("express");
const http = require("http");
const cors = require("cors");
const socketSetup = require("./socket.js");
const path = require("path");
const dotenv = require("dotenv");
// Loads the right .env file depending on NODE_ENV
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: path.resolve(process.cwd(), `.env.${env}`) });
console.log(`running in env ${env}`);
const db = require("./db.js");

const app = express();
const server = http.createServer(app);
const io = socketSetup(server);

app.use(cors());
app.use(express.json());

// Rutas
app.use("/api/auth", require("./routes/auth"));
app.use("/api/backupKeys", require("./routes/backupKeys"));
app.use("/api/qrCodes", require("./routes/qrCodes"));
app.use("/api/recollectionCenters", require("./routes/recollectionCenters"));
// app.use('/api/events', require('./routes/events'));
// app.use('/api/users', require('./routes/users'));

// Servidor escuchando
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});

app.get("/health", (req, res) => {
  res.status(200).json({ message: "Servidor funcionando correctamente" });
});
