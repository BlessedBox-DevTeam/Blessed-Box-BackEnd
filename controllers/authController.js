const {
  newUserDetails,
  findByCredentials,
  findByEmail,
  activateUser,
  getUserRolesByUserId,
  newUserRole,
  updateLastLogin
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
      return res.status(400).json({ error: "Formato de email incorrecto" });
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

    try {
      await dynamo.onUserRegistration(
        userResponse.data,
        normalizedEmail,
        otpHash
      );
    } catch (enqueueErr) {
      console.error("onUserRegistration error:", enqueueErr);
      // No fallamos la respuesta al usuario; podemos reintentar en background o mediante endpoint.
    }

    await conn.commit();

    try {
      await sendRegistrationMessage({
        userId: userResponse.data,
        email: normalizedEmail,
        name: namesObject.name,
        lastName: namesObject.lastName,
        otp
      });
    } catch (sqsErr) {
      console.error("sendRegistrationMessage error:", sqsErr);
    }

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
    const { email, password, keepMeSignedIn } = req.body;
    let refreshToken = null;

    const { success, data, error } = await findByCredentials(email, conn);
    if (!success) {
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
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
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }

    const lastLoginResponse = await updateLastLogin(data.userId, conn);
    if (!lastLoginResponse.success) {
      return res
        .status(500)
        .json({ success: false, message: "Internal server error." });
    }

    const accessToken = jwt.sign(
      { userId: data.userId, email: data.email, roles: rolesResponse.data },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

    // Opción B (alternativa): guardar hash del accessToken en vez del token en claro
    const hashedToken = await argon2.hash(accessToken);
    await dynamo.onAppOpen(data.userId, hashedToken);

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

    const isValid = await argon2.verify(otpResponse.Item.otpHash, otp);
    if (!isValid) {
      try {
        await dynamo.onUserBadAttempt(userResponse.data.userId);
      } catch (badAttemptErr) {
        console.error("onUserBadAttempt error:", badAttemptErr);
      }
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

    try {
      await sendOtpMessage({
        userId: userResponse.data.userId,
        email: normalizedEmail,
        name: userResponse.data.firstName,
        lastName: userResponse.data.lastName,
        otp: newOtp
      });
    } catch (sqsErr) {
      console.error("sendOtpMessage error:", sqsErr);
    }

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

// if (keepMeSignedIn) {
//   const revokedTokenResponse = await revokedRefreshToken(data.userId, conn);
//   if (!revokedTokenResponse.success) {
//     return res
//       .status(500)
//       .json({ success: false, message: "Error revoking token" });
//   }

//   refreshToken = jwt.sign({ userId: data.userId }, JWT_REFRESH_SECRET, {
//     expiresIn: "7d"
//   });
//   const refreshTokenHash = await argon2.hash(refreshToken);
//   const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

//   const saveResponse = await saveRefreshToken(
//     data.userId,
//     refreshTokenHash,
//     expiresAt,
//     null,
//     null,
//     conn
//   );
//   if (!saveResponse.success) {
//     return res
//       .status(500)
//       .json({ success: false, message: "Error saving refresh token" });
//   }
// }

// async function refreshToken(req, res) {
//   const { refreshToken } = req.body;
//   if (!refreshToken) {
//     return res.status(400).json({
//       success: false,
//       message: "Refresh token required"
//     });
//   }
//   let payload;
//   try {
//     payload = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
//   } catch (err) {
//     console.log(err);
//     return res.status(401).json({
//       success: false,
//       message: "Invalid refresh token"
//     });
//   }
//   const conn = await db.getConnection();
//   const refreshTokenResponse = await getRefreshTokenByUserId(
//     payload.userId,
//     conn
//   );

//   if (!refreshTokenResponse.success) {
//     return res.status(501).json({
//       success: false,
//       message: "Refresh token error"
//     });
//   }
//   const tokenRecord = refreshTokenResponse.data;
//   if (!tokenRecord) {
//     return res.status(401).json({
//       success: false,
//       message: "Refresh token not found"
//     });
//   }
//   // Compare hashed refresh token
//   const isValid = await argon2.verify(tokenRecord.tokenHash, refreshToken);
//   if (!isValid) {
//     return res.status(401).json({
//       success: false,
//       message: "Invalid refresh token"
//     });
//   }
//   // Check expiration
//   const now = new Date();
//   if (tokenRecord.expiresAt && now > tokenRecord.expiresAt) {
//     return res.status(401).json({
//       success: false,
//       message: "Refresh token expired"
//     });
//   }
//   const rolesResponse = await getUserRolesByUserId(payload.userId, conn);
//   if (!rolesResponse.success) {
//     return res.status(500).json({
//       success: false,
//       message: "Could not get user roles"
//     });
//   }
//   // Generate new access token
//   const accessToken = jwt.sign(
//     {
//       userId: payload.userId,
//       roles: rolesResponse.data
//     },
//     JWT_SECRET,
//     { expiresIn: "1h" }
//   );
//   conn.release();
//   return res.json({ success: true, accessToken });
// }

async function logout(req, res) {
  const { accessToken } = req.body;
  let payload;
  try {
    payload = jwt.verify(accessToken, JWT_SECRET);
  } catch (err) {
    console.log(err);
    return res.status(401).json({
      success: false,
      message: "Invalid access token"
    });
  }
  const conn = await db.getConnection();
  const revokedTokenResponse = await revokedRefreshToken(payload.userId, conn);
  if (!revokedTokenResponse.success) {
    return res.status(500).json({
      success: false,
      message: "Could not revoke refresh token"
    });
  }
  conn.release();
  return res.json({ success: true });
}

module.exports = {
  register,
  login,
  verifyOtp,
  resendOtp,
  logout
  // refreshToken
};
