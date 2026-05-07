const express = require("express");
const router = express.Router();
const permissionController = require("../controllers/permissionController");
const { protect, authorize } = require("../middlewares/authMiddleware");

router.use(protect);

// Get the boolean mapped list of permissions. All admins can fetch this.
router.get("/", permissionController.getAvailablePermissions);

// Super Admin Only: Push fixed strings
router.post("/", authorize("SUPERADMIN"), permissionController.pushPermission);

// Scoped allocation of permissions
router.post("/:permissionId/allocate", authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"), permissionController.allocatePermission);

// Bulk allocation per Org
router.post("/organizations/:orgId/bulk", authorize("SUPERADMIN"), permissionController.bulkAllocate);

module.exports = router;
