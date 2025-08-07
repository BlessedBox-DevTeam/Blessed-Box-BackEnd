const express = require('express');
const http = require('http');
const cors = require('cors');
const socketSetup = require('./socket.js');
const db = require('./db.js');
const path = require('path');
require('dotenv').config({
  path: path.resolve(__dirname, '.env'),
});

console.log('__dirname:', __dirname);
console.log('process.env.PORT:', process.env.PORT);



const app = express();
const server = http.createServer(app);
const io = socketSetup(server);

app.use(cors());
app.use(express.json());

// Rutas
app.use('/api/auth', require('./routes/auth'));
// app.use('/api/events', require('./routes/events'));
// app.use('/api/users', require('./routes/users'));

// Servidor escuchando
const PORT = process.env.PORT;
server.listen(PORT, () => {
  console.log(`Servidor escuchando en el puerto ${PORT}`);
});
