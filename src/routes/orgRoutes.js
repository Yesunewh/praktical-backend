const express = require("express");
const { 
  createOrganizationController, 
  getAllOrgsController, 
  getOrgByIdController 
} = require("../controllers/orgControllers");
const { validateOrg } = require("../validators/orgValidators");
const { protect, permissionMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * Super Admin only routes for managing Organizations
 */
router.route("/")
  .post(protect, validateOrg, createOrganizationController)
  .get(protect, getAllOrgsController);

router.route("/:id")
  .get(protect, getOrgByIdController);

module.exports = router;
