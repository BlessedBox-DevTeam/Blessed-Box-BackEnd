const socketIO = require("socket.io");
const { verifyAccessToken } = require("./middleware/token");

module.exports = function (server) {
  const io = socketIO(server, { cors: { origin: "*" } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token missing"));

    try {
      const user = verifyAccessToken(token);
      socket.user = user;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.user.userId;
    socket.join(`user:${userId}`);
  });

  return io;
};
