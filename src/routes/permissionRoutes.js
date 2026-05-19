const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");

router.use(protect);
router.use(assignmentMiddleware);

// Get the boolean mapped list of permissions. All admins can fetch this.
router.get("/", permissionMiddleware("MANAGE_PERMISSIONS"), permissionController.getAvailablePermissions);

// Super Admin Only: Push fixed strings
router.post("/", permissionMiddleware("MANAGE_SYSTEM"), permissionController.pushPermission);

// Scoped allocation of permissions
router.post("/:permissionId/allocate", permissionMiddleware("MANAGE_PERMISSIONS"), permissionController.allocatePermission);

// Bulk allocation per Org
router.post("/organizations/:orgId/bulk", permissionMiddleware("MANAGE_TENANTS"), permissionController.bulkAllocate);

module.exports = router;
