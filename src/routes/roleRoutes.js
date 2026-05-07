const express = require("express");
const router = express.Router();
const roleController = require("../controllers/roleController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// Both ORG ADMIN and UNIT ADMIN can define roles under their jurisdiction.
router.use(protect);

router.post("/", authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"), roleController.createCustomRole);
router.patch("/:id", authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"), roleController.updateCustomRole);
router.get("/", authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN", "DEPT_ADMIN"), roleController.getRoles);

module.exports = router;
