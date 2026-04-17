exports.checkPermission = (permission) => {
    return (req, res, next) => {
      if (!req.user || !req.user.permissions.includes(permission)) {
        return res.status(403).json({ message: "Permission denied" });
      }
      next();
    };
  };
  