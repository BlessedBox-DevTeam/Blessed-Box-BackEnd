const { verifyAccessToken } = require("./token");

const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      message: "Access token required"
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = verifyAccessToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    console.error(error);
    if (error.name === "TokenExpiredError") {
      return res.status(401).json({
        success: false,
        code: "ACCESS_TOKEN_EXPIRED"
      });
    }

    return res.status(401).json({
      success: false,
      code: "ACCESS_TOKEN_INVALID"
    });
  }
};

module.exports = {
  authenticate
};
