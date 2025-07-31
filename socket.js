const socketIO = require('socket.io');

module.exports = function(server) {
  const io = socketIO(server, {
    cors: {
      origin: '*',
    }
  });

  io.on('connection', (socket) => {
    const { userId, email } = socket.handshake.auth;
    console.log(`Usuario conectado: ${email} (ID: ${userId})`);

    // Puedes guardar el usuario en el socket para usarlo más tarde
    socket.userId = userId;
    socket.email = email;

    socket.on('chatMessage', (data) => {
      // Añadir automáticamente el nombre del usuario al mensaje
      const messageWithUser = {
        email: socket.email,
        message: data.message
      };
      io.emit('chatMessage', messageWithUser);
    });

    socket.on('disconnect', () => {
      console.log(`Desconectado: ${socket.email}`);
    });
  });

  return io;
};

