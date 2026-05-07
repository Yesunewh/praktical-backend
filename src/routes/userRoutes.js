const express = require("express");
const {
  applicantRegistrationController,
  userRegistrationController,
  authUserController,
  getAllUsersController,
  updateUserController,
  updateUserPasswordController,
  resetEmailPasswordController,
  resetPasswordController,
  resetUserPasswordController,
  resetUserPasswordByIdController,
  updateLanguagePreferenceController,
  getUserByIdController,
  getUserByPhoneController,
  getAllUsersWithPendingStatusController,
  approveApplicantController,
  rejectApplicantController,
  getUserLoginInfoController,
  deleteUserController,
  deactivateUserController,
  activateUserController,
  adminUpdateUserScopeController,
} = require("../controllers/userControllers");

const {
  validateUser,
  validateUserUpdate,
  validatePassword,
  validateLoginInfo,
  validateEmail,
  validateResetPassword,
  validateEmailAttributes,
  validateAdminUserScope,
  validateApproveApplicant,
} = require("../validators/userValidators");

const {
  protect,
  assignmentMiddleware,
  permissionMiddleware,
  authorize,
  bootstrapOrProtect,
  authorizeAdminsExceptBootstrap,
} = require("../middlewares/authMiddleware");



const router = express.Router();

// ─── User CRUD ──────────────────────────────────────────────────────────────
router.route("/register-applicant").post(validateUser, applicantRegistrationController);
router.route("/").post(
  bootstrapOrProtect,
  authorizeAdminsExceptBootstrap,
  validateUser,
  userRegistrationController
);
router.post("/login", validateLoginInfo, authUserController);
router
  .route("/updateInfo")
  .patch(protect, validateUserUpdate, updateUserController);
router
  .route("/updatePassword")
  .patch(protect, validatePassword, updateUserPasswordController);
router.route("/").get(protect, getAllUsersController);
router
  .route("/forgot-password")
  .post(validateEmail, resetEmailPasswordController);
router
  .route("/reset-password")
  .post(protect, validateResetPassword, resetPasswordController);
router
  .route("/resetPassword/:phoneNumber")
  .patch(protect,
    assignmentMiddleware,
    permissionMiddleware("MANAGE_USERS"), resetUserPasswordController);
router
  .route("/resetPasswordById/:userId")
  .patch(
    protect,
    authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
    resetUserPasswordByIdController
  );
router
  .route("/pendingStatus")
  .get(
    protect,
    authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
    getAllUsersWithPendingStatusController
  );
router.patch("/language", protect, updateLanguagePreferenceController);
router.get("/login-info", protect, getUserLoginInfoController);
router.get("/phone/:phoneNumber", getUserByPhoneController);
router.patch(
  "/:userId/approve-applicant",
  protect,
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  validateApproveApplicant,
  approveApplicantController
);
router.post(
  "/:userId/reject-applicant",
  protect,
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  rejectApplicantController
);
router.patch(
  "/:userId/admin-scope",
  protect,
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  validateAdminUserScope,
  adminUpdateUserScopeController
);
router
  .route("/:userId")
  .get(protect, getUserByIdController)
  .delete(protect, assignmentMiddleware, permissionMiddleware("MANAGE_USERS"), deleteUserController);

router.patch(
  "/:userId/deactivate",
  protect,
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  deactivateUserController
);
router.patch(
  "/:userId/activate",
  protect,
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  activateUserController
);

// router.route("/sendBulkEmail").post(protect,validateEmailAttributes, sendBulkEmailController);





module.exports = router;
