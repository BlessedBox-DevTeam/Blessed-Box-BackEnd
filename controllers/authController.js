const {
  newUserDetails,
  findByCredentials,
  findByEmail,
  activateUser,
  getUserRolesByUserId,
  newUserRole,
  updateLastLogin,
  getPermissionsByRoleIds
} = require("../models/User");
const argon2 = require("argon2");
const jwt = require("jsonwebtoken");
const db = require("../db.js");
const {
  validateEmail,
  formatNamesToTitleCase
} = require("../helpers/helpers.js");
const { STAFF_ROLE_TYPE_ID } = require("../helpers/constants.js");
const dynamo = require("../dynamoDB/dynamoDB.js");
const { sendRegistrationMessage, sendOtpMessage } = require("../sqs/SQS");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configura tu archivo .env");
}

async function register(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { password, email, name, lastName } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);
    if (!valid) {
      throw new Error("Formato de email incorrecto");
    }

    const existing = await findByCredentials(normalizedEmail, conn);
    if (existing.success && existing.data) {
      return res.status(200).json({
        message:
          "Si no existe una cuenta con este email, recibirás instrucciones por correo."
      });
    }

    const passwordHash = await argon2.hash(password);
    const namesObject = formatNamesToTitleCase({ name, lastName });

    const userResponse = await newUserDetails(
      passwordHash,
      normalizedEmail,
      namesObject.name,
      namesObject.lastName,
      conn
    );
    if (!userResponse.success) {
      throw new Error(userResponse.error);
    }

    const roleResponse = await newUserRole(
      userResponse.data,
      STAFF_ROLE_TYPE_ID,
      conn
    );
    if (!roleResponse.success) {
      throw new Error(roleResponse.error);
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);

    await dynamo.onUserRegistration(
      userResponse.data,
      normalizedEmail,
      otpHash
    );

    await sendRegistrationMessage({
      userId: userResponse.data,
      email: normalizedEmail,
      name: namesObject.name,
      lastName: namesObject.lastName,
      otp
    });

    await conn.commit();
    return res.status(201).json({
      message: "Usuario registrado. Revisa tu correo para confirmar tu cuenta."
    });
  } catch (err) {
    await conn.rollback();
    return res.status(500).json({ error: err.message || "Error interno" });
  } finally {
    conn.release();
  }
}

async function login(req, res) {
  const conn = await db.getConnection();
  try {
    const { email, password } = req.body;

    const { success, data, error } = await findByCredentials(email, conn);
    if (!success) {
      return res.status(500).json({
        success: false,
        message: "Internal server error.(findByCredentials)"
      });
    }
    if (!data) {
      return res
        .status(401)
        .json({ success: false, message: "User not found" });
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
        message:
          rolesResponse.message ||
          "Internal server error (getUserRolesByUserId)."
      });
    }
    const roleIds = rolesResponse.data.map((role) => role.roleId);
    const roles = rolesResponse.data.map(({ roleId, ...role }) => role);

    const permissionsResponse = await getPermissionsByRoleIds(roleIds, conn);
    if (!permissionsResponse.success) {
      return res.status(500).json({
        success: false,
        message:
          permissionsResponse.message ||
          "Internal server error (getPermissionsByRoleIds)."
      });
    }

    const lastLoginResponse = await updateLastLogin(data.userId, conn);
    if (!lastLoginResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Internal server error (updateLastLogin)."
      });
    }

    const refreshToken = jwt.sign(
      {
        userId: data.userId,
        email: data.email,
        roles: roles,
        permissions: permissionsResponse.data
      },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );
    const accessToken = jwt.sign(
      {
        userId: data.userId,
        email: data.email,
        roles: roles,
        permissions: permissionsResponse.data
      },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    const hashedToken = await argon2.hash(refreshToken);
    await dynamo.onAppOpen(data.userId, hashedToken);

    return res.json({
      success: true,
      message: "Login exitoso",
      accessToken,
      refreshToken
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, message: "Internal server error." });
  } finally {
    conn.release();
  }
}

async function verifyOtp(req, res) {
  const conn = await db.getConnection();
  try {
    const { email, otp } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);

    if (!valid || !otp) {
      return res.status(400).json({ error: "Email y OTP son obligatorios." });
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error al buscar usuario." });
    }
    if (!userResponse.data) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    if (userResponse.data.is_active === 1) {
      return res.status(400).json({ error: "Usuario ya está verificado." });
    }

    const otpResponse = await dynamo.getUserOtp(userResponse.data.userId);
    if (!otpResponse.Item) {
      return res.status(404).json({ error: "OTP no encontrado o expirado." });
    }
    const isValid = await argon2.verify(otpResponse.Item.otpHash, String(otp));
    if (!isValid) {
      await dynamo.onUserBadAttempt(userResponse.data.userId);
      return res.status(401).json({ error: "OTP incorrecto." });
    }

    await conn.beginTransaction();
    const activateResponse = await activateUser(userResponse.data.userId, conn);
    if (!activateResponse.success) {
      throw new Error(activateResponse.message || "Error activando usuario.");
    }
    await dynamo.deleteUserOtp(userResponse.data.userId);
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: "Usuario verificado correctamente. Ya puedes iniciar sesión."
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  } finally {
    conn.release();
  }
}

async function resendOtp(req, res) {
  const conn = await db.getConnection();
  try {
    const { email } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);

    if (!valid) {
      return res.status(400).json({ error: "Email no válido." });
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error al buscar usuario." });
    }
    if (!userResponse.data) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    if (userResponse.data.is_active === 1) {
      return res.status(400).json({ error: "Usuario ya está verificado." });
    }

    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtpHash = await argon2.hash(newOtp);

    await dynamo.onUserResend(userResponse.data.userId, newOtpHash);

    await sendOtpMessage({
      userId: userResponse.data.userId,
      email: normalizedEmail,
      name: userResponse.data.firstName,
      lastName: userResponse.data.lastName,
      otp: newOtp
    });
    return res.status(200).json({
      success: true,
      message: "OTP reenviado. Revisa tu correo."
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Error interno." });
  } finally {
    conn.release();
  }
}

async function refreshToken(req, res) {
  let conn;

  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: "Refresh token required"
      });
    }

    const verification = verifyRefreshToken(refreshToken);
    if (!verification.valid) {
      return res.status(401).json({
        success: false,
        message:
          verification.error.name === "TokenExpiredError"
            ? "Refresh token expired"
            : "Invalid refresh token"
      });
    }

    const { userId, email } = verification.payload;
    const sessionResponse = await dynamo.getAppSession(String(userId));
    const session = sessionResponse.Item;

    const nowInSeconds = Math.floor(Date.now() / 1000);

    if (
      !session ||
      session.status !== "ACTIVE" ||
      (session.expiresAt && session.expiresAt <= nowInSeconds)
    ) {
      return res.status(401).json({
        success: false,
        message: "Refresh token expired or revoked"
      });
    }

    console.log(verification.payload);

    console.log(session);

    console.log(refreshToken);

    const isValid = await argon2.verify(session.sessionId, refreshToken);
    if (!isValid) {
      console.log("invalid");
      return res.status(401).json({
        success: false,
        message: "Invalid refresh token"
      });
    }

    conn = await db.getConnection();
    const rolesResponse = await getUserRolesByUserId(userId, conn);
    if (!rolesResponse.success) {
      return res.status(500).json({
        success: false,
        message:
          rolesResponse.message ||
          "Internal server error (getUserRolesByUserId)."
      });
    }
    const roleIds = rolesResponse.data.map((role) => role.roleId);
    const roles = rolesResponse.data.map(({ roleId, ...role }) => role);

    const permissionsResponse = await getPermissionsByRoleIds(roleIds, conn);
    if (!permissionsResponse.success) {
      return res.status(500).json({
        success: false,
        message:
          permissionsResponse.message ||
          "Internal server error (getPermissionsByRoleIds)."
      });
    }

    const newRefreshToken = jwt.sign(
      {
        userId,
        email,
        roles: roles,
        permissions: permissionsResponse.data
      },
      JWT_REFRESH_SECRET,
      { expiresIn: "7d" }
    );

    const accessToken = jwt.sign(
      {
        userId,
        email,
        roles: roles,
        permissions: permissionsResponse.data
      },
      JWT_SECRET,
      { expiresIn: "5m" }
    );

    const hashedRefreshToken = await argon2.hash(newRefreshToken);
    await dynamo.onAppOpen(userId, hashedRefreshToken);

    return res.json({
      success: true,
      accessToken,
      refreshToken: newRefreshToken
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  } finally {
    if (conn) {
      conn.release();
    }
  }
}

async function logout(req, res) {
  try {
    const { refreshToken } = req.body;
    const { valid, payload } = verifyRefreshToken(refreshToken);
    if (!valid) {
      return res.status(401).json({
        success: false,
        message:
          payload.name === "TokenExpiredError"
            ? "Refresh token expired"
            : "Invalid refresh token"
      });
    }

    const userId = payload.userId;
    await dynamo.onAppClose(userId);
    return res.json({
      success: true
    });
  } catch (err) {
    console.error(err);

    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  }
}
function verifyRefreshToken(token) {
  try {
    return {
      valid: true,
      payload: jwt.verify(token, JWT_REFRESH_SECRET)
    };
  } catch (err) {
    return {
      valid: false,
      error: err
    };
  }
}

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  logout,
  refreshToken
};
