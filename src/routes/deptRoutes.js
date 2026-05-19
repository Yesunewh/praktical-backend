const express = require("express");
const { 
  createDeptController, 
  getOrgsDeptController, 
  getDeptByIdController,
  updateDeptController,
} = require("../controllers/deptControllers");
const { validateDept, validateDeptPatch } = require("../validators/deptValidators");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * Department management
 */
router.route("/")
  .post(protect, assignmentMiddleware, permissionMiddleware("MANAGE_DEPARTMENTS"), validateDept, createDeptController);

router.get("/organization/:orgId", protect, assignmentMiddleware, getOrgsDeptController);
router.get("/organization", protect, assignmentMiddleware, getOrgsDeptController); // Gets own org departments

router.patch("/:id", protect, assignmentMiddleware, permissionMiddleware("MANAGE_DEPARTMENTS"), validateDeptPatch, updateDeptController);

router.route("/:id")
  .get(protect, assignmentMiddleware, getDeptByIdController);

module.exports = router;
