const path = require("path");
const dotenv = require("dotenv");

// Cargar variables de entorno primero
const env = process.env.NODE_ENV || "development";
dotenv.config({ path: path.resolve(process.cwd(), `.env.${env}`) });

const express = require("express");
const http = require("http");
const cors = require("cors");
const helmet = require("helmet");
const db = require("./db"); // ahora ve las variables correctamente
const socketSetup = require("./socket");

// Validar variables críticas
const PORT = process.env.PORT || 3000;

if (!process.env.JWT_SECRET) throw new Error("JWT_SECRET no definido en .env");

const app = express();
const server = http.createServer(app);
const io = socketSetup(server, db);
app.set("io", io);

// Middlewares
app.use(helmet());
app.use(
  cors({
    origin: env === "production" ? ["https://tu-dominio.com"] : "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
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
    await db.query("SELECT 1"); // simple query para comprobar DB
    res
      .status(200)
      .json({ message: "Servidor y DB funcionando correctamente" });
  } catch (err) {
    res.status(500).json({ message: "DB caída", error: err.message });
  }
});

// Middleware global de errores
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Algo salió mal en el servidor" });
});

// Inicializar servidor
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Servidor escuchando en puerto ${PORT}`);
});
