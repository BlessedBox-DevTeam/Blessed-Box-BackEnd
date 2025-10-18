const {
  create,
  findByCredentials,
  getUserRolesByUserId
} = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../db.js");

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configura tu archivo .env");
}

async function register(req, res) {
  const { username, password, email } = req.body;
  try {
    // TODO: handle caps and formats
    await create(username, password, email);
    res.status(201).json({ message: "Usuario registrado" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error al registrar" });
  }
}

async function login(req, res) {
  const conn = await db.getConnection();
  const { email, password } = req.body;
  const { success, data, error } = await findByCredentials(email, conn);
  if (!success) {
    return res.status(500).json({
      error: error,
      message: "Internal server error."
    });
  } else if (success && !data) {
    return res.status(401).json({
      success: false,
      message: "User not found"
    });
  }
  const isValid = await argon2.verify(data.passwordHash, password);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Your email or password is incorrect."
    });
  }
  const rolesResponse = await getUserRolesByUserId(data.userId, conn);
  if (!rolesResponse.success) {
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
  // Firmar el token
  const token = jwt.sign(
    { userId: data.userId, email: data.email, roles: rolesResponse.data },
    JWT_SECRET,
    { expiresIn: "1h" } // puedes ajustar la expiración
  );
  return res.json({
    success: true,
    message: "Login exitoso",
    token,
    user: { userId: data.userId, email: data.email, roles: rolesResponse.data }
  });
}

module.exports = {
  register,
  login
};
