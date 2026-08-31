const socketIO = require("socket.io");
const jwt = require("jsonwebtoken");
const JWT_SECRET = process.env.JWT_SECRET;

module.exports = function (server, db) {
  const io = socketIO(server, { cors: { origin: "*" } });

  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error("Token missing"));

    try {
      const payload = jwt.verify(token, JWT_SECRET);
      socket.userId = payload.userId;
      socket.email = payload.email;
      next();
    } catch (err) {
      next(new Error("Invalid token"));
    }
  });

  io.on("connection", async (socket) => {
    // 1. Disconnect previous session
    const [session] = await db.query(
      "SELECT socketId FROM usersessions WHERE userId = ?",
      [socket.userId]
    );
    if (session?.socket_id && io.sockets.sockets.get(session.socket_id)) {
      io.sockets.sockets.get(session.socket_id).disconnect(true);
    }

    // 2. Save new session
    await db.query(
      "INSERT INTO usersessions (userId, socketId) VALUES (?, ?) ON DUPLICATE KEY UPDATE socketId = ?, last_connected = NOW()",
      [socket.userId, socket.id, socket.id]
    );

    socket.on("disconnect", async () => {
      await db.query(
        "DELETE FROM usersessions WHERE userId = ? AND socketId = ?",
        [socket.userId, socket.id]
      );
    });
  });

  return io;
};
