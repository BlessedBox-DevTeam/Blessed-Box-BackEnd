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
const { STAFF_ROLE_TYPE_ID } = require("../helpers/constants.js");

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET no está definido. Configura tu archivo .env");
}

async function register(req, res) {
  const conn = await db.getConnection();
  await conn.beginTransaction();

  const { password, email, name, lastName } = req.body;
  const { valid, normalizedEmail } = validateEmail(email);
  if (!valid) {
    conn.release();
    return res.status(400).json({ error: "Formato de email incorrecto" });
  }

  const passwordHash = await argon2.hash(password);
  const namesObject = formatNamesToTitleCase({ name, lastName });

  const accountId = accountResponse.data;

  const userResponse = await newUserDetails(
    passwordHash,
    normalizedEmail,
    namesObject.name,
    namesObject.lastName,
    conn
  );

  if (!userResponse.success) {
    await conn.rollback();
    conn.release();
    return res.status(500).json({ error: userResponse.error });
  }

  const roleResponse = await newUserRole(
    userResponse.data,
    STAFF_ROLE_TYPE_ID,
    conn
  );
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
  let refreshToken = null;

  try {
    const { success, data, error } = await findByCredentials(email, conn);
    if (!success) {
      return res.status(500).json({
        error: error,
        message: "Internal server error."
      });
    } else if (!data) {
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
    const lastLoginResponse = await updateLastLogin(data.userId, conn);
    if (!lastLoginResponse.success) {
      return res.status(500).json({
        success: false,
        message: "Internal server error."
      });
    }
    const accessToken = jwt.sign(
      { userId: data.userId, email: data.email, roles: rolesResponse.data },
      JWT_SECRET,
      { expiresIn: "1h" }
    );

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
    conn.release();
    res.json({
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
    conn.release();
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
}

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
  logout
  // refreshToken
};
