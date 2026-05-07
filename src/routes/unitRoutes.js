const express = require("express");
const router = express.Router();
const unitController = require("../controllers/unitController");
const { protect, authorize } = require("../middlewares/authMiddleware");

// All unit operations require authentication, mostly administrative.
router.use(protect);

// Unit Types (Level definitions)
router.post(
  "/types",
  authorize("SUPERADMIN", "ORG_ADMIN"),
  unitController.createUnitType
);

router.put(
  "/types/:id",
  authorize("SUPERADMIN", "ORG_ADMIN"),
  unitController.updateUnitType
);

router.get(
  "/types",
  unitController.getUnitTypes
);

// Organizational Units (The actual branches/offices tree)
router.post(
  "/",
  authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"),
  unitController.createUnit
);

router.put(
  "/:id",
  authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"),
  unitController.updateUnit
);

router.get(
  "/tree",
  authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"),
  unitController.getUnitsTree
);

module.exports = router;
