const db = require("../db.js");

const MAX_FAILED_ATTEMPTS = 10;

const getUserId = (req) => req.user?.userId;

const releaseConnection = async (conn, rollback = false) => {
  if (rollback) {
    try {
      await conn.rollback();
    } catch (error) {
      console.error(error);
    }
  }
  conn.release();
};

const auditAttempt = async (conn, userId, enteredCode, success) => {
  await conn.query(
    `INSERT INTO access_code_logs (user_id, entered_code, success)
     VALUES (?, ?, ?)`,
    [userId, enteredCode, success]
  );
};

const rateLimitAccessCode = async (req, res, next) => {
  const userId = getUserId(req);

  if (!userId) {
    return res.status(401).json({
      success: false,
      message: "Authenticated user is required."
    });
  }

  const conn = await db.getConnection();
  const enteredCode = String(req.body?.keyValue ?? "");

  try {
    await conn.beginTransaction();

    const [rows] = await conn.query(
      `SELECT failed_attempts, locked_until
       FROM access_code_rate_limits
       WHERE user_id = ?
       FOR UPDATE`,
      [userId]
    );
    const rateLimit = rows[0];
    const isLocked =
      rateLimit?.locked_until &&
      new Date(rateLimit.locked_until).getTime() > Date.now();

    if (isLocked) {
      await auditAttempt(conn, userId, enteredCode, false);
      await conn.commit();
      conn.release();
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Try again in 15 minutes."
      });
    }

    let isFinalized = false;
    req.dbConnection = conn;
    req.finishAccessCodeAttempt = async (success) => {
      if (isFinalized) return;
      try {
        await auditAttempt(conn, userId, enteredCode, success);
        if (success) {
          await conn.query(
            "DELETE FROM access_code_rate_limits WHERE user_id = ?",
            [userId]
          );
        } else {
          await conn.query(
            `INSERT INTO access_code_rate_limits (user_id, failed_attempts)
             VALUES (?, 1)
             ON DUPLICATE KEY UPDATE
               failed_attempts = failed_attempts + 1,
               updated_at = UTC_TIMESTAMP()`,
            [userId]
          );
          const [updatedRows] = await conn.query(
            `SELECT failed_attempts
             FROM access_code_rate_limits
             WHERE user_id = ?`,
            [userId]
          );
          const failedAttempts = updatedRows[0].failed_attempts;

          if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
            await conn.query(
              `UPDATE access_code_rate_limits
               SET locked_until = DATE_ADD(UTC_TIMESTAMP(), INTERVAL 15 MINUTE)
               WHERE user_id = ?`,
              [userId]
            );
          }
        }

        await conn.commit();
        isFinalized = true;
        conn.release();
      } catch (error) {
        isFinalized = true;
        await releaseConnection(conn, true);
        throw error;
      }
    };

    req.abortAccessCodeAttempt = async () => {
      if (isFinalized) return;
      isFinalized = true;
      await releaseConnection(conn, true);
    };

    next();
  } catch (error) {
    await releaseConnection(conn, true);
    console.error(error);
    return res.status(500).json({
      success: false,
      message: "Unable to validate access-code rate limit."
    });
  }
};

module.exports = {
  rateLimitAccessCode
};
