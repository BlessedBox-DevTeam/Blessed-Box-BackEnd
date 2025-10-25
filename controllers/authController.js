const {
  create,
  findByCredentials,
  getUserRolesByUserId,
  saveRefreshToken,
  getRefreshTokenByUserId,
  revokedRefreshToken
} = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../db.js");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
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
  const { email, password, keepMeSignedIn } = req.body;
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
  const accessToken = jwt.sign(
    { userId: data.userId, email: data.email, roles: rolesResponse.data },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  let refreshToken = null;

  // Si el usuario eligió "Keep me signed in"
  if (keepMeSignedIn) {
    const revokedTokenResponse = await revokedRefreshToken(data.userId, conn);
    if (!revokedTokenResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Error deleting old refresh token"
      });
    }

    refreshToken = jwt.sign({ userId: data.userId }, JWT_REFRESH_SECRET, {
      expiresIn: "7d"
    });
    const refreshTokenHash = await argon2.hash(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días

    const saveResponse = await saveRefreshToken(
      data.userId,
      refreshTokenHash,
      expiresAt,
      null,
      null,
      conn
    );
    if (!saveResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Could not save refresh token"
      });
    }
  }
  return res.json({
    success: true,
    message: "Login exitoso",
    accessToken,
    refreshToken,
    user: {
      userId: data.userId,
      email: data.email,
      roles: rolesResponse.data
    }
  });
}

async function refreshToken(req, res) {
  const { refreshToken } = req.body;
  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: "Refresh token required"
    });
  }
  let payload;
  try {
    // Verify refresh token signature
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (err) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token"
    });
  }

  const conn = await db.getConnection();
  // Get refresh token record from DB
  const refreshTokenResponse = await getRefreshTokenByUserId(
    payload.userId,
    conn
  );

  if (!refreshTokenResponse.success) {
    return res.status(501).json({
      success: false,
      message: "Refresh token error"
    });
  }
  const tokenRecord = refreshTokenResponse.data;
  if (!tokenRecord) {
    return res.status(401).json({
      success: false,
      message: "Refresh token not found"
    });
  }
  // Compare hashed refresh token
  const isValid = await argon2.verify(tokenRecord.tokenHash, refreshToken);
  if (!isValid) {
    return res.status(401).json({
      success: false,
      message: "Invalid refresh token"
    });
  }
  // Check expiration
  const now = new Date();
  if (tokenRecord.expiresAt && now > tokenRecord.expiresAt) {
    return res.status(401).json({
      success: false,
      message: "Refresh token expired"
    });
  }
  // Get user's roles from DB to include in new access token
  const rolesResponse = await getUserRolesByUserId(payload.userId, conn);
  if (!rolesResponse.success) {
    return res.status(500).json({
      success: false,
      message: "Could not get user roles"
    });
  }
  // Generate new access token
  const accessToken = jwt.sign(
    {
      userId: payload.userId,
      roles: rolesResponse.data
    },
    JWT_SECRET,
    { expiresIn: "1h" }
  );
  return res.json({ success: true, accessToken });
}

module.exports = {
  register,
  login,
  refreshToken
};
