const dotenv = require("dotenv");
dotenv.config();
const env = process.env.NODE_ENV || "development";

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./db"); // now sees the variables correctly
// const socketSetup = require("./socket");

// Validate critical variables
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no definido en .env");

const app = express();
const server = http.createServer(app);
// const io = socketSetup(server, db);
// app.set("io", io);

// Middlewares
app.use(helmet());
app.use(
  cors({
    // origin: env === "production" ? ["https://tu-dominio.com"] : "*",
    origin: "*"
    // methods: ["GET", "POST", "PUT", "DELETE"],
    // credentials: true
  })
);
app.use(express.json());

// Rutas
app.use("/api/auth", require("./routes/auth"));
app.use("/api/backupKeys", require("./routes/backupKeys"));
app.use("/api/qrCodes", require("./routes/qrCodes"));
app.use("/api/recollectionCenters", require("./routes/recollectionCenters"));
app.use("/api/transactions", require("./routes/transactions"));
app.use("/api/boxes", require("./routes/boxes"));

// Health check (verifica servidor y DB)
app.get("/health", async (req, res) => {
  try {
    await db.query("SELECT 1"); // simple query to check DB
    res.status(200).json({ message: "Server and DB working correctly" });
  } catch (err) {
    res.status(500).json({ message: "DB down", error: err.message });
  }
});

// Global error middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Something went wrong on the server" });
});

// Inicializar servidor
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
