const express = require("express");
const { 
  createOrganizationController, 
  getAllOrgsController, 
  getOrgByIdController 
} = require("../controllers/orgControllers");
const { validateOrg } = require("../validators/orgValidators");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");

const { upload } = require("../middlewares/uploadMiddleware");

const router = express.Router();

/**
 * Super Admin only routes for managing Organizations
 */
router.route("/")
  .post(protect, assignmentMiddleware, permissionMiddleware("MANAGE_TENANTS"), upload.single("logo"), validateOrg, createOrganizationController)
  .get(protect, assignmentMiddleware, permissionMiddleware("MANAGE_TENANTS"), getAllOrgsController);

router.route("/:id")
  .get(protect, assignmentMiddleware, getOrgByIdController);

module.exports = router;
