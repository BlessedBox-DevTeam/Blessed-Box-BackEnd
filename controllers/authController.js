const { create, findByCredentials } = require("../models/User");
const argon2 = require("argon2");

async function register(req, res) {
  const { username, password, email } = req.body;
  try {
    await create(email, password, email);
    res.status(201).json({ message: "Usuario registrado" });
  } catch (error) {
    res.status(500).json({ error: "Error al registrar" });
  }
}

async function login(req, res) {
  const { email, password } = req.body;
  try {
    const { passwordHash } = await findByCredentials(email);
    const isValid = await argon2.verify(passwordHash, password);
    if (isValid) {
      res.json({ message: "Login exitoso" });
    } else {
      res.json({ message: "Credenciales incorrectas" });
    }
  } catch (error) {
    res.status(500).json({ error: "Error al iniciar sesión" });
  }
}

module.exports = {
  register,
  login
};
