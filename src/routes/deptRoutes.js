const express = require("express");
const { 
  createDeptController, 
  getOrgsDeptController, 
  getDeptByIdController,
  updateDeptController,
} = require("../controllers/deptControllers");
const { validateDept, validateDeptPatch } = require("../validators/deptValidators");
const { protect } = require("../middlewares/authMiddleware");

const router = express.Router();

/**
 * Department management
 */
router.route("/")
  .post(protect, validateDept, createDeptController);

router.get("/organization/:orgId", protect, getOrgsDeptController);
router.get("/organization", protect, getOrgsDeptController); // Gets own org departments

router.patch("/:id", protect, validateDeptPatch, updateDeptController);

router.route("/:id")
  .get(protect, getDeptByIdController);

module.exports = router;
