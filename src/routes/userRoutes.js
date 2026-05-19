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
  getRegistrationRejectionLogsController,
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

const assignmentExceptBootstrap = (req, res, next) => {
  if (req.allowFirstAdminBootstrap) return next();
  return assignmentMiddleware(req, res, next);
};

// ─── User CRUD ──────────────────────────────────────────────────────────────
router.route("/register-applicant").post(validateUser, applicantRegistrationController);
router.route("/").post(
  bootstrapOrProtect,
  assignmentExceptBootstrap,
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
router
  .route("/")
  .get(
    protect,
    assignmentMiddleware,
    permissionMiddleware("MANAGE_USERS"),
    getAllUsersController
  );
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
    assignmentMiddleware,
    permissionMiddleware("MANAGE_USERS"),
    resetUserPasswordByIdController
  );
router
  .route("/pendingStatus")
  .get(
    protect,
    assignmentMiddleware,
    permissionMiddleware("MANAGE_USERS"),
    getAllUsersWithPendingStatusController
  );
router
  .route("/rejection-logs")
  .get(
    protect,
    assignmentMiddleware,
    permissionMiddleware("MANAGE_USERS"),
    getRegistrationRejectionLogsController
  );
router.patch("/language", protect, updateLanguagePreferenceController);
router.get("/login-info", protect, getUserLoginInfoController);
router.get("/phone/:phoneNumber", getUserByPhoneController);
router.patch(
  "/:userId/approve-applicant",
  protect,
  assignmentMiddleware,
  permissionMiddleware("MANAGE_USERS"),
  validateApproveApplicant,
  approveApplicantController
);
router.post(
  "/:userId/reject-applicant",
  protect,
  assignmentMiddleware,
  permissionMiddleware("MANAGE_USERS"),
  rejectApplicantController
);
router.patch(
  "/:userId/admin-scope",
  protect,
  assignmentMiddleware,
  permissionMiddleware("MANAGE_USERS"),
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
  assignmentMiddleware,
  permissionMiddleware("MANAGE_USERS"),
  deactivateUserController
);
router.patch(
  "/:userId/activate",
  protect,
  assignmentMiddleware,
  permissionMiddleware("MANAGE_USERS"),
  activateUserController
);

// router.route("/sendBulkEmail").post(protect,validateEmailAttributes, sendBulkEmailController);





module.exports = router;
