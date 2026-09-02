const {
  newUserDetails,
  findByCredentials,
  findByEmail,
  activateUser,
  getUserRolesByUserId,
  newUserRole,
  updateLastLogin,
  getPermissionsByRoleIds,
  updatePassword
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
  throw new Error("JWT_SECRET is not defined. Configure your .env file");
}

async function register(req, res) {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    const { password, email, name, lastName } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);
    if (!valid) {
      throw new Error("Email format incorrect");
    }

    const existing = await findByCredentials(normalizedEmail, conn);
    if (existing.success && existing.data) {
      return res.status(200).json({
        success: false,
        message: "If an account exists, you will receive instructions."
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
      success: true,
      message: "User registered. Check your email to confirm your account."
    });
  } catch (err) {
    await conn.rollback();
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal server error" });
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
        email: data.email
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
      message: "Login successful",
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
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error at finding user." });
    }
    if (!userResponse.data) {
      return res.status(404).json({ error: "User not found." });
    }
    if (userResponse.data.isActive) {
      return res.status(400).json({ error: "User is already verified." });
    }
    const now = Math.floor(Date.now() / 1000);
    const otpResponse = await dynamo.getUserOtp(userResponse.data.userId);
    if (!otpResponse.Item || otpResponse.Item.ttl <= now) {
      return res.status(404).json({ error: "OTP not found or expired." });
    }
    const isValid = await argon2.verify(otpResponse.Item.otpHash, String(otp));
    if (!isValid) {
      await dynamo.onUserBadAttempt(userResponse.data.userId);
      return res.status(401).json({ error: "Incorrect OTP." });
    }

    await conn.beginTransaction();
    const activateResponse = await activateUser(userResponse.data.userId, conn);
    if (!activateResponse.success) {
      throw new Error(activateResponse.message || "Error activating user.");
    }
    await dynamo.deleteUserOtp(userResponse.data.userId);
    await conn.commit();

    return res.status(200).json({
      success: true,
      message: "User verified successfully. You can now sign in."
    });
  } catch (err) {
    await conn.rollback();
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Error interno." });
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
      return res.status(400).json({ error: "Invalid email." });
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error al buscar usuario." });
    }
    if (!userResponse.data) {
      return res.status(404).json({ error: "Usuario no encontrado." });
    }
    if (userResponse.data.isActive === 1) {
      return res.status(400).json({ error: "User is already verified." });
    }

    const otpResponse = await dynamo.getUserOtp(userResponse.data.userId);
    const userId = userResponse.data.userId;
    const now = Math.floor(Date.now() / 1000);
    const newOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const newOtpHash = await argon2.hash(newOtp);

    if (!otpResponse.Item || otpResponse.Item.ttl <= now) {
      await dynamo.onUserRegistration(userId, email, newOtpHash);
    } else {
      await dynamo.onUserResend(userId, newOtpHash);
    }

    await sendOtpMessage({
      userId: userId,
      email: normalizedEmail,
      name: userResponse.data.firstName,
      lastName: userResponse.data.lastName,
      otp: newOtp
    });
    return res.status(200).json({
      success: true,
      message: "OTP sent. Please verify your email."
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal Error." });
  } finally {
    conn.release();
  }
}

async function refreshTokens(req, res) {
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

    const isValid = await argon2.verify(session.sessionId, refreshToken);
    if (!isValid) {
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
        email
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
async function forgotPassword(req, res) {
  const conn = await db.getConnection();
  try {
    const { email } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);
    if (!valid) {
      throw new Error("Email format incorrect");
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (
      !userResponse.success ||
      !userResponse.data ||
      !userResponse.data.isActive
    ) {
      return res.status(500).json({ error: "Error at finding user." });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = await argon2.hash(otp);

    await dynamo.onUserRegistration(
      userResponse.data.userId,
      normalizedEmail,
      otpHash
    );

    await sendOtpMessage({
      userId: userId,
      email: normalizedEmail,
      name: userResponse.data.firstName,
      lastName: userResponse.data.lastName,
      otp: newOtp
    });
    return res.status(200).json({
      success: true,
      message: "OTP sent. Please verify your email."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  } finally {
    conn.release();
  }
}
async function verifyResetPasswordOtp(req, res) {
  const conn = await db.getConnection();
  try {
    const { email, otp } = req.body;
    const { valid, normalizedEmail } = validateEmail(email);

    if (!valid || !otp) {
      return res.status(400).json({ error: "Email and OTP are required." });
    }

    const userResponse = await findByEmail(normalizedEmail, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error at finding user." });
    }
    if (!userResponse.data) {
      return res.status(404).json({ error: "User not found." });
    }

    const now = Math.floor(Date.now() / 1000);
    const otpResponse = await dynamo.getUserOtp(userResponse.data.userId);
    if (!otpResponse.Item || otpResponse.Item.ttl <= now) {
      return res.status(404).json({ error: "OTP not found or expired." });
    }
    const isValid = await argon2.verify(otpResponse.Item.otpHash, String(otp));
    if (!isValid) {
      await dynamo.onUserBadAttempt(userResponse.data.userId);
      return res.status(401).json({ error: "Incorrect OTP." });
    }

    const accessToken = jwt.sign(
      { userId: userResponse.data.userId },
      JWT_SECRET,
      { expiresIn: "5m" }
    );
    await dynamo.deleteUserOtp(userResponse.data.userId);

    return res.status(200).json({
      success: true,
      accessToken,
      message: "OTP verified successfully."
    });
  } catch (err) {
    console.error(err);
    return res
      .status(500)
      .json({ success: false, error: err.message || "Internal Error." });
  } finally {
    conn.release();
  }
}
async function changePassword(req, res) {
  const conn = await db.getConnection();
  try {
    const { userId } = req.user;
    const { password } = req.body;
    if (!password) throw new Error("Password not provided.");

    const passwordHash = await argon2.hash(password);
    const userResponse = await updatePassword(userId, passwordHash, conn);
    if (!userResponse.success) {
      return res.status(500).json({ error: "Error updating user." });
    }
    await conn.commit();
    return res.status(200).json({
      success: true,
      message: "Password changed successfully."
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Internal server error."
    });
  } finally {
    conn.release();
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
  refreshTokens,
  forgotPassword,
  verifyResetPasswordOtp,
  changePassword
};
