const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");

// Both ORG ADMIN and UNIT ADMIN can define roles under their jurisdiction.
router.use(protect);
router.use(assignmentMiddleware);

const getRolesPermissionMiddleware = async (req, res, next) => {
  try {
    if (req.user && req.user.isSuperAdmin) {
      return next();
    }
    const userPerms = req.user?.role?.permissions || [];
    const allowed = ["MANAGE_ROLES", "MANAGE_USERS", "MANAGE_HIERARCHY", "MANAGE_DEPARTMENTS"];
    const hasAny = allowed.some(p => userPerms.includes(p));
    if (hasAny) {
      return next();
    }
    const { Permission, UserPermission } = require("../models");
    const matchedPerms = await Permission.findAll({
      where: { name: allowed }
    });
    if (matchedPerms.length > 0 && req.user?.assignment?.id) {
      const override = await UserPermission.findOne({
        where: {
          assignment_id: req.user.assignment.id,
          permission_id: matchedPerms.map(p => p.id)
        }
      });
      if (override) {
        return next();
      }
    }
    return res.status(403).json({ success: false, message: "You do not have permission to perform this action" });
  } catch (error) {
    next(error);
  }
};

router.post("/", permissionMiddleware("MANAGE_ROLES"), roleController.createCustomRole);
router.patch("/:id", permissionMiddleware("MANAGE_ROLES"), roleController.updateCustomRole);
router.get("/", getRolesPermissionMiddleware, roleController.getRoles);

module.exports = router;
