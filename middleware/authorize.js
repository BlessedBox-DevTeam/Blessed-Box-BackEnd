const authorize = (requiredPermissions) => {
  return (req, res, next) => {
    console.log(req.user, requiredPermissions);

    const userPermissions = req.user?.permissions || [];

    const hasPermission = requiredPermissions.some((permission) =>
      userPermissions.includes(permission)
    );

    if (!hasPermission) {
      return res.status(403).json({
        message: "You do not have permission to perform this action."
      });
    }

    next();
  };
};

module.exports = {
  authorize
};
