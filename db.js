const mysql = require("mysql2/promise");

const db = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASS,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  typeCast: function (field, next) {
    // Si el tipo es BIT y solo mide 1 bit de longitud
    if (field.type === "BIT" && field.length === 1) {
      const bytes = field.buffer();
      return bytes === null ? null : bytes[0] === 1;
    }
    return next();
  }
});

module.exports = db;
