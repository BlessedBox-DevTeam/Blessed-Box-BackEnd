const dotenv = require("dotenv");
dotenv.config();
const mysql = require("mysql2/promise");

// Cargar variables antes de usar
const env = process.env.NODE_ENV || "development";

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0
});

module.exports = db;
