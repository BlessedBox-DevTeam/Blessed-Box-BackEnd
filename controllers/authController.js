const {
  newUserDetails,
  findByCredentials,
  getUserRolesByUserId,
  saveRefreshToken,
  getRefreshTokenByUserId,
  revokedRefreshToken,
  newAccount,
  newUserRole
} = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../db.js");
const {
  validateEmail,
  formatNamesToTitleCase
} = require("../helpers/helpers.js");
const { ADMIN_ROLE_TYPE_ID } = require("../helpers/constants");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configura tu archivo .env");
}

async function register(req, res) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  const { password, email, name, middleName, lastName, secondLastName } =
    req.body;
  const { valid, normalized } = validateEmail(email);
  if (!valid) {
    conn.release();
    return res.status(400).json({ error: "Formato de email incorrecto" });
  }

  const passwordHash = await argon2.hash(password);
  const namesObject = formatNamesToTitleCase({
    name,
    middleName,
    lastName,
    secondLastName
  });

  const accountResponse = await newAccount(conn);
  if (!accountResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({ error: accountResponse.error });
  }

  const accountId = accountResponse.data;

  const userResponse = await newUserDetails(
    passwordHash,
    normalized,
    namesObject.name,
    namesObject.middleName,
    namesObject.lastName,
    namesObject.secondLastName,
    accountId,
    conn
  );

  if (!userResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({ error: userResponse.error });
  }

  const roleResponse = await newUserRole(accountId, ADMIN_ROLE_TYPE_ID, conn);
  if (!roleResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({ error: roleResponse.error });
  }

  await conn.commit();
  conn.release();
  res.status(201).json({ message: "Usuario registrado" });
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
  console.time("argon");
  const isValid = await argon2.verify(data.passwordHash, password);
  console.timeEnd("argon");

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
  conn.release();
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
    console.log(refreshToken);
    payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
  } catch (err) {
    console.log(err);
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
  conn.release();
  return res.json({ success: true, accessToken });
}

module.exports = {
  register,
  login,
  refreshToken
};
