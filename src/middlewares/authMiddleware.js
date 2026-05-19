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
      if (!userId) {
        return next(new AppError("Invalid token payload: user_id missing.", 401));
      }

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

const {
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");

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

    // 1. Identify Platform Super Admin (isSuperAdmin)
    // Condition: org_id is null AND assigned the 'Super Admin' role
    const isPlatformAdmin = user.org_id === null;
    const superAdminAssignment = await UserAssignment.findOne({
      where: { user_id: user.user_id },
      include: [{ model: Role, where: { name: SUPER_ADMIN_BASELINE_ROLE_NAME } }]
    });

    if (isPlatformAdmin && superAdminAssignment) {
      req.user = {
        id: user.user_id,
        user_id: user.user_id,
        org_id: null,
        status: user.status,
        isSuperAdmin: true,
        role: { name: SUPER_ADMIN_BASELINE_ROLE_NAME },
        permissions: [] // Will be loaded by next middleware or bypass
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

    // 2. Standard Branch/Unit Assignment
    const assignment = await UserAssignment.findOne({
      where: { user_id: user.user_id },
      include: [
        {
          model: OrganizationalUnit,
          include: [{ model: require("../models/unitTypeModel"), as: "Type", attributes: ["level"] }]
        },
        { model: Role, include: [{ model: Permission, attributes: ["name"] }] }
      ]
    });

    if (!assignment) {
      return next(
        new AppError(
          "User is active but has no branch assignment. Contact a superadmin.",
          403
        )
      );
    }

    const unit = assignment.OrganizationalUnit;
    // Removed strict throw here: An Organization Admin might not have a unit assigned yet
    // if the organization hierarchy hasn't been built.

    const role = assignment.Role;
    if (!role) {
      return next(new AppError("Assigned role not found", 500));
    }

    // Attach full context to request
    req.user = {
      id: user.user_id,
      user_id: user.user_id,
      org_id: user.org_id,
      dept_id: user.dept_id,
      status: user.status,
      isSuperAdmin: false,
      unit: unit ? unit.toJSON() : null,
      unit_id: unit ? unit.id : null,
      unit_level: unit?.Type?.level ?? null,  // null = top-level (safe default)
      assignment: {
        id: assignment.id,
      },
      role: {
        id: role.id,
        name: role.name,
        permissions: role.Permissions.map(p => p.name)
      }
    };

    next();
  } catch (error) {
    next(error);
  }
};

const permissionMiddleware = (requiredPermissionName) => {
  return async (req, res, next) => {
    try {
      if (req.user && req.user.isSuperAdmin) {
        return next(); // SuperAdmin bypass
      }

      // 1️⃣ Ensure assignmentMiddleware ran
      if (!req.user || !req.user.assignment || !req.user.role) {
        return next(new AppError("Unauthorized: Missing user assignment context", 401));
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
    const actorRoleName = req.user?.role?.name;
    const isSuperAdmin = req.user?.isSuperAdmin;
    
    // Check if the actor's role name is in the allowed list, or if they are a superadmin
    const isAuthorized = roles.includes(actorRoleName) || (isSuperAdmin && roles.includes(SUPER_ADMIN_BASELINE_ROLE_NAME));

    if (!req.user || !isAuthorized) {
      return next(new AppError("Access Denied: You do not have the required permissions to perform this action.", 403));
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
  return authorize(
    SUPER_ADMIN_BASELINE_ROLE_NAME,
    ORG_ADMIN_BASELINE_ROLE_NAME,
    DEPT_ADMIN_BASELINE_ROLE_NAME,
    BRANCH_UNIT_BASELINE_ROLE_NAME
  )(req, res, next);
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
