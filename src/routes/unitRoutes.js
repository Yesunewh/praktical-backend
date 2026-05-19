const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unitController");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");

// All unit operations require authentication, mostly administrative.
router.use(protect);
router.use(assignmentMiddleware);

// Unit Types (Level definitions)
router.post(
  "/types",
  permissionMiddleware("MANAGE_TERMINOLOGY"),
  unitController.createUnitType
);

router.put(
  "/types/:id",
  permissionMiddleware("MANAGE_TERMINOLOGY"),
  unitController.updateUnitType
);

router.get(
  "/types",
  unitController.getUnitTypes
);

// Organizational Units (The actual branches/offices tree)
router.post(
  "/",
  permissionMiddleware("MANAGE_HIERARCHY"),
  unitController.createUnit
);

router.put(
  "/:id",
  permissionMiddleware("MANAGE_HIERARCHY"),
  unitController.updateUnit
);

router.get(
  "/tree",
  permissionMiddleware("VIEW_DASHBOARD"), // Hierarchy view usually tied to dashboard access
  unitController.getUnitsTree
);

module.exports = router;
