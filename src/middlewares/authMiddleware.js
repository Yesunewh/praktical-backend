const jwt = require("jsonwebtoken");
const { AppError } = require("../middlewares/errorMiddleware");
const User = require("../models/userModel");
const UserAssignment = require("../models/userAssignment");
const OrganizationalUnit = require("../models/organizationalUnitModel");
const Role = require("../models/roleModel");
const Permission = require("../models/permissionModel");
const UserPermission = require("../models/userPermissionModel");
const RolePermission = require("../models/rolePermissionModel");


const protect = (req, res, next) => {
  // Get token from header
  const token =
    req.headers.authorization && req.headers.authorization.startsWith("Bearer")
      ? req.headers.authorization.split(" ")[1]
      : null;

  // Check if token exists
  if (!token) {
    return next(
      new AppError("You are not logged in! Please log in to get access.", 401)
    );
  }

  // Verify token
  jwt.verify(token, process.env.JWT_SECRET, async (err, decoded) => {
    if (err) {
      return next(new AppError("Invalid token. Please log in again.", 401));
    }

    try {
      // Correctly access the nested payload if it exists
      const tokenPayload = decoded.payload || decoded;
      const userId = tokenPayload.user_id;

      // Fetch fresh user data to ensure the scope is fully populated
      const user = await User.findByPk(userId);

      if (!user) {
        console.error(`Auth Error: User with ID ${userId} not found in DB.`);
        return next(new AppError("User no longer exists.", 401));
      }

      if (user.status === "DEACTIVATED") {
        return next(new AppError("Your account has been deactivated.", 401));
      }

      // Attach user data directly to request object
      req.user = user;

      // Override global i18n if no header was provided
      if (!req.headers["accept-language"]) {
        req.lang = user.language_preference || req.lang;
      }

      next();
    } catch (error) {
      next(error);
    }
  });
};

const levelGuard = (allowedLevels = []) => {
  return (req, res, next) => {
    if (!req.user || !req.user.unit) {
      return next(new AppError("Unauthorized", 401));
    }

    const userLevel = req.user.unit.level;

    if (!allowedLevels.includes(userLevel)) {
      return next(
        new AppError(
          "You do not have access to perform this action at your level",
          403
        )
      );
    }

    next();
  };
};

const assignmentMiddleware = async (req, res, next) => {
  try {
    // `protect` attaches a Sequelize User as req.user (has user_id), not req.user.payload
    const modelUser = req.user;
    if (!modelUser || !modelUser.user_id) {
      return next(new AppError("Unauthorized", 401));
    }

    const user = await User.findByPk(modelUser.user_id);
    if (!user) {
      return next(new AppError("User not found", 404));
    }

    if (user.status === "DEACTIVATED") {
      return next(new AppError("Account is deactivated", 403));
    }

    if (user.user_type === "SUPERADMIN") {
      req.user = {
        id: user.user_id,
        user_id: user.user_id,
        user_type: user.user_type,
        status: user.status,
        isSuperAdmin: true,
      };
      return next();
    }

    if (user.status === "UNASSIGNED") {
      return next(
        new AppError(
          "Your account is awaiting assignment by an administrator",
          403,
          "PENDING_ASSIGNMENT"
        )
      );
    }

    const assignment = await UserAssignment.findOne({
      where: { user_id: user.user_id },
    });

    if (!assignment) {
      return next(
        new AppError(
          "User is active but has no branch assignment. Contact a superadmin.",
          403
        )
      );
    }

    // 6️⃣ Load unit
    const unit = await OrganizationalUnit.findByPk(assignment.unit_id);
    if (!unit) {
      return next(new AppError("Assigned unit not found", 500));
    }

    // 7️⃣ Load role
    const role = await Role.findByPk(assignment.role_id);
    if (!role) {
      return next(new AppError("Assigned role not found", 500));
    }

    // 8️⃣ Attach context to request
    req.user = {
      id: user.user_id,
      status: user.status,
      assignment: {
        id: assignment.id,
      },
      unit: {
        id: unit.id,
        level: unit.level,
        parent_id: unit.parent_id,
        name: unit.name,
      },
      role: {
        id: role.id,
        name: role.name,
      },
    };


    next();
  } catch (error) {
    next(error);
  }
};

const permissionMiddleware = (requiredPermissionName) => {
  return async (req, res, next) => {
    try {
      if (req.user?.isSuperAdmin) {
        return next();
      }

      // 1️⃣ Ensure assignmentMiddleware ran
      if (!req.user || !req.user.assignment || !req.user.role) {
        return next(new AppError("Unauthorized", 401));
      }

      const assignmentId = req.user.assignment.id;
      const roleId = req.user.role.id;

      // 2️⃣ Find permission by name
      const permission = await Permission.findOne({
        where: { name: requiredPermissionName },
      });

      if (!permission) {
        return next(
          new AppError(
            `Permission '${requiredPermissionName}' is not defined`,
            500
          )
        );
      }

      // 3️⃣ Check Role-level permission (The Standard)
      const rolePermission = await RolePermission.findOne({
        where: {
          role_id: roleId,
          permission_id: permission.id,
        },
      });

      if (rolePermission) {
        return next(); // Permission granted by Role
      }

      // 4️⃣ Check User-level override (The Exception)
      const userPermission = await UserPermission.findOne({
        where: {
          assignment_id: assignmentId,
          permission_id: permission.id,
        },
      });

      if (userPermission) {
        return next(); // Permission granted by Override
      }

      // 5️⃣ Permission denied
      return next(
        new AppError(
          "You do not have permission to perform this action",
          403
        )
      );
    } catch (error) {
      next(error);
    }
  };
};



const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.user_type)) {
      return next(new AppError(`Access Denied: Requires one of ${roles.join(", ")}`, 403));
    }
    next();
  };
};

/** When DB has no users, next() without auth (bootstrap first super admin). Otherwise run `protect`. */
const bootstrapOrProtect = (req, res, next) => {
  User.count()
    .then((n) => {
      if (n === 0) {
        req.allowFirstAdminBootstrap = true;
        return next();
      }
      return protect(req, res, next);
    })
    .catch(next);
};

/** Pair with `bootstrapOrProtect`. Skips role check only for `allowFirstAdminBootstrap`. */
const authorizeAdminsExceptBootstrap = (req, res, next) => {
  if (req.allowFirstAdminBootstrap) return next();
  return authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN")(req, res, next);
};

module.exports = {
  protect,
  levelGuard,
  assignmentMiddleware,
  permissionMiddleware,
  authorize,
  bootstrapOrProtect,
  authorizeAdminsExceptBootstrap,
};
