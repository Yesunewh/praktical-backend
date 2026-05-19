const {
  User,
  Organization,
  Department,
  AdministrativeUnit,
  OrganizationalUnit,
  Role,
  Permission,
  UserAssignment,
  UserPermission,
  RolePermission,
  AuditLog,
  LoginLog,
  RegistrationRejectionLog,
} = require("../models");
const unitService = require("./unitService");

const { hashPassword, comparePassword } = require("../utils/hashUtils");
const { AppError } = require("../middlewares/errorMiddleware");
const { Op } = require("sequelize");
const generateToken = require("../utils/tokenUtil");
const jwt = require("jsonwebtoken");
const sendEmail = require("../utils/sendEmail"); // Utility to send emails
const { JWT_SECRET, RESET_PASSWORD_TOKEN_EXPIRY, CLIENT_URL } = process.env;
const sequelize = require("../config/database");
const { PASS_SCORE_PERCENT } = require("../constants/challengeProgression");
const {
  DEFAULT_LEARNER_PERMISSION_NAMES,
  DEFAULT_LEARNER_ROLE_NAME,
} = require("../config/defaultLearnerPermissions");
const {
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");
const { getBaselinePermissionNamesForLogin, scopePermissionsForBranchAdminLevel } = require("./baselineRoleLoginResolver");

const defaultPasswordPlain = () => process.env.DEFAULT_PASSWORD || "Password123";

/** Human-readable role label for profile: DB assignment role name(s), else user_type fallback */
function roleDisplayNameForLogin(assignments) {
  const fromAssignments = [
    ...new Set((assignments || []).map((a) => a.Role?.name).filter(Boolean)),
  ];
  if (fromAssignments.length > 0) {
    return fromAssignments.join(", ");
  }
  return "";
}

const registerUserService = async (
  first_name,
  last_name,
  username,
  email,
  phone_number,
  password,
  language_preference,
  org_id = null,
  dept_id = null,
  unit_id = null,
  status = null,
  role_id = null
) => {

  const transaction = await sequelize.transaction();
  try {
    // ✅ Check duplicates
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { phone_number },
          { username: username || null },
          { email: email || null }
        ]
      },
      transaction
    });

    if (existingUser) {
      if (existingUser.phone_number === phone_number) throw new AppError("errors.phone_exists", 400);
      if (existingUser.username && existingUser.username === username) throw new AppError("errors.username_exists", 400);
      if (existingUser.email && existingUser.email === email) throw new AppError("errors.email_exists", 400);
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    // ✅ Cross-validate dept_id and unit_id
    if (dept_id) {
      const targetDept = await Department.findOne({
        where: { id: dept_id }, // org_id check handled inherently by targetDept.org_id === org_id if needed, but the ID is globally unique
        transaction
      });
      if (!targetDept || (org_id && String(targetDept.org_id) !== String(org_id))) {
        throw new AppError("Department not found in your organization.", 404);
      }
      
      const deptUnitId = targetDept.unit_id ? String(targetDept.unit_id) : "null";
      const userUnitId = unit_id ? String(unit_id) : "null";
      if (deptUnitId !== userUnitId) {
        throw new AppError("The assigned department does not belong to the assigned branch. Department and branch must match.", 400);
      }
    }

    // Check if this is the first user
    const firstUser = !(await User.findOne({ transaction }));

    // Create user
    const user = await User.create({
      first_name,
      last_name,
      username: username || null,
      email: email || null,
      phone_number,
      password: hashedPassword,
      language_preference,
      org_id,
      dept_id,
      unit_id,
      status: status || (firstUser ? "ACTIVE" : "UNASSIGNED"),
    }, { transaction });

    // ✅ Automatic Assignment Logic
    let finalRoleId = role_id;

    if (firstUser) {
      const superRole = await Role.findOne({
        where: { name: SUPER_ADMIN_BASELINE_ROLE_NAME, org_id: { [Op.is]: null } },
        transaction
      });
      if (superRole) {
        finalRoleId = superRole.id;
      }
    }

    if (finalRoleId) {
       await UserAssignment.create({
         user_id: user.user_id,
         unit_id: unit_id || null,
         role_id: finalRoleId
       }, { transaction });
       console.log(`Role assignment created for ${first_name}`);
    }

    // Triggered campaign automation for active users
    try {
      if (user.status === "ACTIVE") {
        const gamificationService = require("./gamificationService");
        await gamificationService.triggerAssignmentsForUser(user, transaction);
      }
    } catch (err) {
      console.error("Failed to run campaign triggers for registered user:", err);
    }

    await transaction.commit();
    return user;
  } catch (error) {
    await transaction.rollback();

    // Log the error for internal tracking
    console.error("Registration Error Detailed:", error);

    if (error instanceof AppError) throw error;

    // Handle Sequelize Unique Constraint Errors
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0].path;
      if (field === "email") throw new AppError("errors.email_exists", 400);
      if (field === "username") throw new AppError("errors.username_exists", 400);
      if (field === "phone_number") throw new AppError("errors.phone_exists", 400);
    }

    if (error.name === "SequelizeValidationError") {
      throw new AppError(error.errors[0].message, 400);
    }

    throw new AppError(`Database error: Unable to create user - ${error.message}`, 500);
  }
};

const registerApplicantService = async (
  first_name,
  last_name,
  username,
  email,
  phone_number,
  password,
  language_preference,
  org_id = null
) => {

  const transaction = await sequelize.transaction();
  try {
    // Check duplicates
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          { phone_number },
          { username: username || null },
          { email: email || null }
        ]
      },
      transaction
    });

    if (existingUser) {
      if (existingUser.phone_number === phone_number) throw new AppError("errors.phone_exists", 400);
      if (existingUser.username && existingUser.username === username) throw new AppError("errors.username_exists", 400);
      if (existingUser.email && existingUser.email === email) throw new AppError("errors.email_exists", 400);
    }

    const hashedPassword = await hashPassword(password);

    const user = await User.create({
      first_name,
      last_name,
      username: username || null,
      email: email || null,
      phone_number,
      password: hashedPassword,
      language_preference,
      org_id,
      status: "UNASSIGNED",
    }, { transaction });


    await transaction.commit();
    return user;
  } catch (error) {
    await transaction.rollback();
    console.error("Registration Error Detailed:", error);
    if (error instanceof AppError) throw error;
    if (error.name === "SequelizeUniqueConstraintError") {
      const field = error.errors[0].path;
      if (field === "email") throw new AppError("errors.email_exists", 400);
      if (field === "username") throw new AppError("errors.username_exists", 400);
      if (field === "phone_number") throw new AppError("errors.phone_exists", 400);
    }
    if (error.name === "SequelizeValidationError") {
      throw new AppError(error.errors[0].message, 400);
    }
    throw new AppError("Database error: Unable to create user", 500);
  }
};

const loginService = async (phone_number, password, ip_address, user_agent) => {
  // 1️⃣ Find user by phone number (using withPassword scope to bypass default privacy)
  const user = await User.scope("withPassword").findOne({
    where: { phone_number },
    include: [
      { model: Organization, attributes: ["id", "name"], required: false },
      { model: Department, attributes: ["id", "name"], required: false },
    ],
  });

  const logAttempt = async (status, failure_reason = null) => {
    try {
      await LoginLog.create({
        user_id: user ? user.user_id : null,
        identifier: phone_number,
        ip_address: ip_address || null,
        user_agent: user_agent || null,
        status,
        failure_reason
      });
    } catch (logError) {
      console.error("Failed to create login log:", logError);
    }
  };

  if (!user) {
    // Check if this phone number belongs to a rejected applicant in our rejection logs
    const rejectedLog = await RegistrationRejectionLog.findOne({
      where: { phone_number },
      order: [["rejected_at", "DESC"]], // Fetch the most recent rejection log
    });

    if (rejectedLog) {
      await logAttempt("FAILED", "registration_rejected");
      throw new AppError("errors.registration_rejected", 403);
    }

    await logAttempt("FAILED", "invalid_credentials");
    throw new AppError("errors.invalid_credentials", 401);
  }

  // 2️⃣ Check password
  const isMatch = await comparePassword(password, user.password);
  if (!isMatch) {
    await logAttempt("FAILED", "invalid_password");
    throw new AppError("errors.invalid_credentials", 401);
  }

  // 3️⃣ Check if user is assigned
  if (user.status === "UNASSIGNED") {
    await logAttempt("SUCCESS", "account_pending"); // Log as success but pending status
    return {
      message: "errors.account_pending",
      status: "UNASSIGNED",
    };
  }

  if (user.status === "DEACTIVATED") {
    await logAttempt("FAILED", "account_deactivated");
    throw new AppError("errors.account_deactivated", 403);
  }

  // 3.5️⃣ Fetch Permissions based on Role/Type
  let assignments = [];
  let permissionList = [];

  // 4️⃣ Fetch all assignments for this user (include UnitType for level resolution)
  assignments = await UserAssignment.findAll({
    where: { user_id: user.user_id },
    include: [
      { model: Role, attributes: ["name", "description"] },
      {
        model: OrganizationalUnit,
        attributes: ["id", "name", "parent_id"],
        include: [{ model: require("../models/unitTypeModel"), as: "Type", attributes: ["level"] }]
      },
    ],
  });

  const isSuperAdmin = user.org_id === null && assignments.some(a => a.Role?.name === "Super Admin");

  if (isSuperAdmin) {
    // SuperAdmins get all permissions as a bypass
    const allPermissions = await Permission.findAll({ attributes: ["name"] });
    permissionList = allPermissions.map(p => p.name);
  } else {
    // 4️⃣ Fetch all assignments for this user
    assignments = await UserAssignment.findAll({
      where: { user_id: user.user_id },
      include: [
        { model: Role, attributes: ["name", "description"] },
        { model: OrganizationalUnit, attributes: ["id", "name", "parent_id"] },
      ],
    });

    let rolePermissions = [];
    let userOverrides = [];
    if (assignments.length > 0) {
      const roleIds = assignments.map((a) => a.role_id);
      const assignmentIds = assignments.map((a) => a.id);
      rolePermissions = await RolePermission.findAll({
        where: { role_id: { [Op.in]: roleIds } },
        include: [{ model: Permission, attributes: ["name"] }],
      });
      userOverrides = await UserPermission.findAll({
        where: { assignment_id: { [Op.in]: assignmentIds } },
        include: [{ model: Permission, attributes: ["name"] }],
      });
    }

    const permissionSet = new Set();
    rolePermissions.forEach((rp) => permissionSet.add(rp.Permission.name));
    userOverrides.forEach((uo) => permissionSet.add(uo.Permission.name));

    permissionList = Array.from(permissionSet);

    if (permissionList.length === 0) {
      const fromDb = await getBaselinePermissionNamesForLogin(DEFAULT_LEARNER_ROLE_NAME);
      permissionList =
        fromDb && fromDb.length > 0 ? fromDb : [...DEFAULT_LEARNER_PERMISSION_NAMES];
    }

    // ✅ Apply level-based permission scoping for Branch Admins
    const branchAdminAssignment = assignments.find(a => a.Role?.name === BRANCH_UNIT_BASELINE_ROLE_NAME);
    if (branchAdminAssignment) {
      const unitLevel = branchAdminAssignment.OrganizationalUnit?.Type?.level ?? null;
      permissionList = scopePermissionsForBranchAdminLevel(permissionList, unitLevel);
    }
  }

  // Calculate derived user_type for frontend compatibility
  let user_type = "STAFF";
  if (isSuperAdmin) {
    user_type = "SUPERADMIN";
  } else if (assignments.some(a => a.Role?.name === "Organization Admin")) {
    user_type = "ORG_ADMIN";
  } else if (assignments.some(a => a.Role?.name === "Branch Admin")) {
    user_type = "UNIT_ADMIN";
  } else if (assignments.some(a => a.Role?.name === "Department Admin")) {
    user_type = "DEPT_ADMIN";
  }

  // 8️⃣ Generate JWT token
  const tokenPayload = {
    user_id: user.user_id,
    status: user.status,
    user_type,
    unit_id: user.unit_id,
    assignments: assignments.map((a) => ({
      assignment_id: a.id,
      role: a.Role ? a.Role.name : null,
      unit: a.OrganizationalUnit
        ? {
            id: a.OrganizationalUnit.id,
            name: a.OrganizationalUnit.name,
            parent_id: a.OrganizationalUnit.parent_id,
            level: a.OrganizationalUnit.Type?.level ?? null,
          }
        : null,
    })),
    permissions: permissionList,
    language_preference: user.language_preference,
    org_id: user.org_id,
    dept_id: user.dept_id,
  };


  const token = generateToken(tokenPayload);

  await logAttempt("SUCCESS");

  const department_name = user.Department ? user.Department.name : null;
  const role_display_name = roleDisplayNameForLogin(assignments);

  return {
    token,
    user: {
      user_id: user.user_id,
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      email: user.email,
      status: user.status,
      user_type,
      mustChangePassword: user.mustChangePassword,
      language_preference: user.language_preference,
      org_id: user.org_id,
      dept_id: user.dept_id,
      unit_id: user.unit_id,
      Organization: user.Organization,
      Department: user.Department,
      department_name,
      role_display_name,
      /** Account registration time (`Users.createdAt`) */
      created_at: user.createdAt ? user.createdAt.toISOString() : null,
      gamification_xp: user.gamification_xp,
      gamification_level: user.gamification_level,
      gamification_xp_to_next: user.gamification_xp_to_next,
      gamification_reputation: user.gamification_reputation,
      gamification_streak: user.gamification_streak,
      gamification_longest_streak: user.gamification_longest_streak,
      gamification_last_activity: user.gamification_last_activity,
    },

    assignments: tokenPayload.assignments,
    permissions: permissionList,
  };
};

const updateUserService = async (
  userId,
  firstName,
  lastName,
  email,
  phoneNumber,
  username,
  language_preference
) => {
  // Check if the user exists
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  // Check if phone number or username is already in use by another user
  if (phoneNumber || username) {
    const existingUser = await User.findOne({
      where: {
        [Op.or]: [
          phoneNumber ? { phone_number: phoneNumber } : null,
          username ? { username: username } : null,
        ].filter(Boolean),
        user_id: { [Op.ne]: userId }
      },
    });

    if (existingUser) {
      const key = existingUser.phone_number === phoneNumber ? "errors.phone_exists" : "errors.username_exists";
      throw new AppError(key, 400);
    }
  }

  // Update user details
  user.first_name = firstName || user.first_name;
  user.last_name = lastName || user.last_name;
  user.phone_number = phoneNumber || user.phone_number;
  user.email = email === "" ? null : (email || user.email);
  user.username = username === "" ? null : (username || user.username);
  user.language_preference = language_preference || user.language_preference;

  await user.save();

  return user;
};

const updatePasswordService = async (userId, currentPassword, newPassword) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  const isPasswordValid = await comparePassword(currentPassword, user.password);
  if (!isPasswordValid) {
    throw new AppError("errors.current_password_incorrect", 400);
  }

  user.password = await hashPassword(newPassword);
  user.mustChangePassword = false;
  await user.save();

  return { success: true, message: "success.password_updated" };
};

const getAllUsersService = async (orgId = null, deptId = null, unitId = null) => {
  try {
    const where = {};
    if (orgId) where.org_id = orgId;
    if (deptId) where.dept_id = deptId;
    if (unitId) where.unit_id = unitId;

    const passedChallengeCount = sequelize.literal(
      `(SELECT COUNT(DISTINCT "challenge_id")::int FROM "GamificationAttempts" AS "ga" WHERE "ga"."user_id" = "User"."user_id" AND "ga"."completed_at" IS NOT NULL AND ("ga"."passed" = true OR "ga"."score" >= ${PASS_SCORE_PERCENT}))`
    );

    // List users only (no assignment graph): including UserAssignment with nested
    // belongsTo joins can produce INNER JOIN behavior and drop rows or empty the list
    // when combined with org_id filters in some Sequelize query shapes.
    const users = await User.findAll({
      where,
      attributes: [
        "user_id",
        "first_name",
        "last_name",
        "phone_number",
        "status",
        "username",
        "email",
        "org_id",
        "dept_id",
        "unit_id",
        // "user_type" removed for pure RBAC
        "gamification_xp",
        "gamification_level",
        "gamification_xp_to_next",
        "gamification_reputation",
        "gamification_streak",
        "gamification_longest_streak",
        "gamification_last_activity",
        [passedChallengeCount, "passed_challenge_count"],
      ],
      include: [
        { model: Organization, attributes: ["id", "name"], required: false },
        { model: Department, attributes: ["id", "name"], required: false },
        {
          model: UserAssignment,
          include: [{ model: Role, attributes: ["name"] }],
          required: false,
        },
      ],
    });

    if (!users || users.length === 0) {
      return [];
    }

    // Map users to include roleDisplayName
    const result = users.map((u) => {
      const userJson = u.toJSON();
      const roles = (userJson.UserAssignments || [])
        .map((a) => a.Role?.name)
        .filter(Boolean);
      
      let roleDisplayName = roles.join(", ");
      
      if (!roleDisplayName) {
        roleDisplayName = "Learner";
      }

      // Map roles to virtual user_type for frontend compatibility
      let user_type = "STAFF";
      if (roles.includes("Super Admin")) user_type = "SUPERADMIN";
      else if (roles.includes("Organization Admin")) user_type = "ORG_ADMIN";
      else if (roles.includes("Branch Admin")) user_type = "UNIT_ADMIN";
      else if (roles.includes("Department Admin")) user_type = "DEPT_ADMIN";

      return {
        ...userJson,
        roleDisplayName,
        user_type,
      };
    });

    return result;
  } catch (error) {
    throw new AppError(
      error.message || "Database error: Unable to fetch users",
      500
    );
  }
};


const resetEmailPasswordService = async (email) => {
  const existingUser = await User.findOne({ where: { email } });

  if (!existingUser) {
    throw new AppError("No user found with this email", 404);
  }

  // Generate reset token (expires in 15 minutes or so)
  const token = jwt.sign(
    { id: existingUser.user_id, email: existingUser.email },
    JWT_SECRET,
    { expiresIn: RESET_PASSWORD_TOKEN_EXPIRY || "15m" }
  );

  // Construct reset link
  const resetLink = `${CLIENT_URL}/reset-password/${token}`;

  // console.log(token);

  // Send email
  const subject = "Password Reset Request";
  const html = `
  <!DOCTYPE html>
  <html>
  <head>
      <style>
          body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f9f9f9;
          }
          .header {
              text-align: center;
              padding: 10px 0;
              background-color: #0f766e;
              color: white;
              border-radius: 8px 8px 0 0;
          }
          .logo {
              font-size: 24px;
              font-weight: bold;
              color: #ffffff;
          }
          .content {
              background-color: white;
              padding: 20px;
              border-radius: 0 0 8px 8px;
              box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
          }
          .button {
              display: inline-block;
              padding: 12px 24px;
              background-color: #0f766e;
              color: #ffffff !important;
              text-decoration: none;
              border-radius: 5px;
              font-weight: bold;
              margin: 15px 0;
              text-align: center;
          }
          .footer {
              text-align: center;
              margin-top: 20px;
              font-size: 12px;
              color: #777;
          }
          .highlight {
              color: #E74C3C;
              font-weight: bold;
          }
      </style>
  </head>
  <body>
      <div class="header">
          <div class="logo">Practikal Platform</div>
          <p>Multi-Tenant Interactive Learning</p>
      </div>
      <div class="content">
          <p>Hello <strong>${existingUser.first_name} ${existingUser.last_name
    }</strong>,</p>
          
          <p>We received a request to reset your password for your <strong>Practikal Platform</strong> account. Let’s get you back on track!</p>
          
          <p style="text-align: center;">
              <a href="${resetLink}" class="button">Reset Your Password</a>
          </p>
          
          <p>For security reasons, this link will <span class="highlight">expire in 15 minutes</span>. If you didn’t request this, please ignore this email.</p>
          
          <p>Keep learning! 🚀</p>
          
          <p>Best regards,<br>Practikal Platform Support</p>
      </div>
      <div class="footer">
          <p>© ${new Date().getFullYear()} Practikal Platform. All rights reserved.</p>
      </div>

  </body>
  </html>
  `;


  const emailAddress = existingUser.email;


  try {
    await sendEmail(emailAddress, subject, html);
  } catch (emailError) {
    console.error("Email sending failed:", emailError.message);
    // You can choose whether to throw or silently ignore
  }


  return { message: "Reset email sent successfully" };
};

const resetPasswordService = async (userId, password) => {
  const existingUser = await User.findOne({
    where: { user_id: userId },
  });

  if (!existingUser) {
    throw new AppError("No user found with this userId", 404);
  }
  const hashedPassword = await hashPassword(password);
  await existingUser.update({
    password: hashedPassword,
  });

  return {
    message: "Password reset successful",
  };

};





const resetUserPasswordService = async (phoneNumber) => {
  const user = await User.findOne({
    where: { phone_number: phoneNumber },
  });
  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  const hashedPassword = await hashPassword(defaultPasswordPlain());
  user.password = hashedPassword;
  user.mustChangePassword = true;
  await user.save();

  return user;
};

const resetUserPasswordByIdService = async (userId) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  const hashedPassword = await hashPassword(defaultPasswordPlain());
  user.password = hashedPassword;
  user.mustChangePassword = true;
  await user.save();

  return user;
};

/**
 * Org admin / department head / superadmin: same scope rules for password reset, deactivate, activate.
 * `actor` is the Sequelize User from `protect` middleware.
 */
const assertStaffAdminScopedTarget = async (actor, target) => {
  if (!target) {
    throw new AppError("errors.user_not_found", 404);
  }
  
  const actorRoleName = actor.role?.name;
  const isPlatformAdmin = actor.org_id === null && actorRoleName === "Super Admin";

  if (isPlatformAdmin) {
    return;
  }

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    if (target.org_id !== actor.org_id) {
      throw new AppError("Forbidden", 403);
    }
    // Cannot manage platform admins
    if (target.org_id === null) {
      throw new AppError("Forbidden", 403);
    }
    return;
  }
  
  if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    if (target.org_id !== actor.org_id || !actor.dept_id || target.dept_id !== actor.dept_id) {
      throw new AppError("Forbidden", 403);
    }
    return;
  }
  
  if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    if (target.org_id !== actor.org_id || !actor.unit_id) {
      throw new AppError("Forbidden", 403);
    }
    const isUnderSubtree = await unitService.isDescendantOf(target.unit_id, actor.unit_id, actor.org_id);
    if (!isUnderSubtree) {
      throw new AppError("Forbidden", 403);
    }
    return;
  }
  throw new AppError("Forbidden: You do not have an administrative role assigned.", 403);
};

/** Password reset from admin console — enforces org / department scope (no branch assignment required). */
const adminResetUserPasswordByIdService = async (actor, targetUserId) => {
  const target = await User.findByPk(targetUserId);
  await assertStaffAdminScopedTarget(actor, target);

  const hashedPassword = await hashPassword(defaultPasswordPlain());
  target.password = hashedPassword;
  target.mustChangePassword = true;
  await target.save();

  return target;
};

const adminDeactivateUserService = async (actor, targetUserId) => {
  const target = await User.findByPk(targetUserId);
  await assertStaffAdminScopedTarget(actor, target);
  const { SUPER_ADMIN_BASELINE_ROLE_NAME } = require("../config/systemBaselineRoles");
  const actorRoleName = actor.role?.name;
  const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  if (!isPlatformAdmin && !actor.isSuperAdmin && String(actor.user_id) === String(target.user_id)) {
    throw new AppError("You cannot deactivate your own account here.", 403);
  }
  if (target.status === "DEACTIVATED") {
    return target;
  }
  target.status = "DEACTIVATED";
  await target.save();
  return target;
};

const adminActivateUserService = async (actor, targetUserId) => {
  const target = await User.findByPk(targetUserId);
  assertStaffAdminScopedTarget(actor, target);
  target.status = "ACTIVE";
  await target.save();
  return target;
};

const updateLanguagePreferenceService = async (userId, languagePreference) => {
  const user = await User.findByPk(userId);
  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  user.language_preference = languagePreference;
  await user.save();

  return user;
};

const getUserByIdService = async (userId) => {
  const user = await User.findByPk(userId, {
    attributes: { exclude: ["password"] },
    include: [
      { model: Organization, attributes: ["id", "name"], required: false },
      { model: Department, attributes: ["id", "name"], required: false },
      {
        model: UserAssignment,
        include: [{ model: Role, attributes: ["name"] }],
        required: false,
      },
    ],
  });

  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  const userJson = user.toJSON();
  const roles = (userJson.UserAssignments || [])
    .map((a) => a.Role?.name)
    .filter(Boolean);
  
  let roleDisplayName = roles.join(", ");
  if (!roleDisplayName) {
    roleDisplayName = "Learner";
  }

  let user_type = "STAFF";
  if (roles.includes("Super Admin")) user_type = "SUPERADMIN";
  else if (roles.includes("Organization Admin")) user_type = "ORG_ADMIN";
  else if (roles.includes("Branch Admin")) user_type = "UNIT_ADMIN";
  else if (roles.includes("Department Admin")) user_type = "DEPT_ADMIN";

  return {
    ...userJson,
    roleDisplayName,
    user_type,
  };
};

const getUserByPhoneService = async (phoneNumber) => {
  const user = await User.findOne({
    where: { phone_number: phoneNumber },
    attributes: { exclude: ["password"] },
    include: [
      { model: Organization, attributes: ["id", "name"], required: false },
      { model: Department, attributes: ["id", "name"], required: false },
      {
        model: UserAssignment,
        include: [
          { model: Role, attributes: ["name"] },
          { model: OrganizationalUnit, attributes: ["id", "name", "parent_id"] }
        ],
        required: false,
      }
    ]
  });

  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  const userJson = user.toJSON();
  const roles = (userJson.UserAssignments || [])
    .map((a) => a.Role?.name)
    .filter(Boolean);
  
  let roleDisplayName = roles.join(", ");
  if (!roleDisplayName) {
    roleDisplayName = "Learner";
  }

  let user_type = "STAFF";
  if (roles.includes("Super Admin")) user_type = "SUPERADMIN";
  else if (roles.includes("Organization Admin")) user_type = "ORG_ADMIN";
  else if (roles.includes("Branch Admin")) user_type = "UNIT_ADMIN";
  else if (roles.includes("Department Admin")) user_type = "DEPT_ADMIN";

  return {
    ...userJson,
    roleDisplayName,
    user_type,
  };
};

/**
 * Pending self-registrations (UNASSIGNED). Scoped by admin type.
 * @param {import("../models/userModel")} actor Sequelize User (req.user)
 */
const getAllUsersWithPendingService = async (actor) => {
  if (!actor) {
    throw new AppError("Unauthorized", 401);
  }

  const where = { status: "UNASSIGNED" };

  const actorRoleName = actor.role?.name;
  const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  if (isPlatformAdmin || actor.isSuperAdmin) {
    // all pending
  } else if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    where[Op.or] = [{ org_id: null }, { org_id: actor.org_id }];
  } else if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    where[Op.and] = [
      { [Op.or]: [{ org_id: null }, { org_id: actor.org_id }] },
      { [Op.or]: [{ dept_id: null }, { dept_id: actor.dept_id }] },
    ];
  } else if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    where[Op.and] = [
      { [Op.or]: [{ org_id: null }, { org_id: actor.org_id }] },
      { [Op.or]: [{ unit_id: null }, { unit_id: actor.unit_id }] },
    ];
  } else {
    throw new AppError("Forbidden: You do not have the required administrative role.", 403);
  }

  return User.findAll({
    where,
    attributes: [
      "user_id",
      "first_name",
      "last_name",
      "phone_number",
      "email",
      "status",
      "org_id",
      "dept_id",
      "createdAt",
    ],
    order: [["createdAt", "ASC"]],
  });
};

/**
 * Approve a self-registered applicant: set org/dept/unit, ACTIVE, and create branch assignment.
 * @param {import("../models/userModel")} actor
 */
const approveApplicantService = async (actor, targetUserId, body) => {
  const { org_id: bodyOrg, dept_id: bodyDept, unit_id, role_id } = body;

  if (!role_id) {
    throw new AppError("role_id is required", 400);
  }

  const transaction = await sequelize.transaction();
  try {
    const target = await User.findByPk(targetUserId, { transaction });
    if (!target) {
      throw new AppError("errors.user_not_found", 404);
    }
    if (target.status !== "UNASSIGNED") {
      throw new AppError("This user is not awaiting approval", 400);
    }
    if (target.org_id !== null && target.org_id !== actor.org_id && !actor.isSuperAdmin) {
      throw new AppError("This approval flow only applies to users within your scope", 400);
    }

    let orgId = bodyOrg === "" || bodyOrg === undefined ? null : bodyOrg;
    let deptId = bodyDept === "" || bodyDept === undefined ? null : bodyDept;

    const actorRoleName = actor.role?.name;
    const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      if (!actor.org_id) {
        throw new AppError("Your account has no organization scope", 403);
      }
      orgId = actor.org_id;

      // Check if target role is a Branch Admin
      const targetRole = await Role.findByPk(role_id, { transaction });
      const isTargetBranchAdmin = targetRole && targetRole.name === BRANCH_UNIT_BASELINE_ROLE_NAME;

      if (isTargetBranchAdmin) {
        if (!unit_id) {
          throw new AppError("A branch / unit must be assigned for a Branch Admin.", 400);
        }
        const unit = await OrganizationalUnit.findOne({
          where: { id: unit_id, org_id: actor.org_id },
          transaction
        });
        if (!unit) {
          throw new AppError("Invalid branch / unit for your organization.", 400);
        }
        if (unit.parent_id !== null) {
          throw new AppError("Forbidden: Organization administrators can only assign Branch Admins to top-level units.", 403);
        }
        if (deptId) {
          const dept = await Department.findByPk(deptId, { transaction });
          if (!dept) {
            throw new AppError("Department not found.", 404);
          }
          if (dept.unit_id !== unit_id) {
            throw new AppError("Forbidden: The assigned department must belong to the assigned branch.", 403);
          }
        }
      } else {
        if (unit_id !== undefined && unit_id !== null && unit_id !== "") {
          throw new AppError("Forbidden: Organization administrators can only assign users at the organization level.", 403);
        }
        if (deptId) {
          const dept = await Department.findByPk(deptId, { transaction });
          if (!dept) {
            throw new AppError("Department not found.", 404);
          }
          if (dept.unit_id !== null) {
            throw new AppError("Forbidden: Organization administrators cannot assign users to branch-level departments.", 403);
          }
        }
      }
    } else if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
      if (!actor.org_id || !actor.dept_id) {
        throw new AppError("Your account has no department scope", 403);
      }
      orgId = actor.org_id;
      if (deptId && deptId !== actor.dept_id) {
        throw new AppError("You can only assign users to your own department", 403);
      }
      if (!deptId) {
        deptId = actor.dept_id;
      }
    } else if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      if (!actor.org_id || !actor.unit_id) {
        throw new AppError("Your account has no branch scope", 403);
      }
      orgId = actor.org_id;
      const isUnderSubtree = await unitService.isDescendantOf(unit_id, actor.unit_id, actor.org_id);
      if (!isUnderSubtree) {
        throw new AppError("Applicants must be assigned to your branch or a sub-branch", 403);
      }
    } else if (!isPlatformAdmin && !actor.isSuperAdmin) {
      throw new AppError("Forbidden", 403);
    }

    if (isPlatformAdmin || actor.isSuperAdmin) {
      if (!orgId && !unit_id) {
        // Platform-level approval: orgId and unit_id are null. This is allowed for SuperAdmins.
      } else {
        if (!orgId) {
          throw new AppError("org_id is required for organization-level approval", 400);
        }
        if (!unit_id) {
          throw new AppError("unit_id is required for organization-level approval", 400);
        }
      }
    } else {
      // Org-level approval requires orgId and unit_id
      // Check if target role is a Branch Admin
      const targetRoleForCheck = await Role.findByPk(role_id, { transaction });
      const isTargetBranchAdminForCheck = targetRoleForCheck && targetRoleForCheck.name === BRANCH_UNIT_BASELINE_ROLE_NAME;
      const isActorOrgAdmin = actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME;

      if (!isTargetBranchAdminForCheck && isActorOrgAdmin) {
        // Normal user by org admin: unit_id must be null, bypass the block
      } else if (!unit_id) {
        throw new AppError("unit_id is required for organization-level approval", 400);
      }

      if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME || actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME || actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
        if (target.org_id && target.org_id !== actor.org_id) {
          throw new AppError("Forbidden", 403);
        }
        if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME && target.dept_id && target.dept_id !== actor.dept_id) {
          throw new AppError("Forbidden", 403);
        }
        if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME && target.unit_id) {
          const isUnderSubtree = await unitService.isDescendantOf(target.unit_id, actor.unit_id, actor.org_id);
          if (!isUnderSubtree) throw new AppError("Forbidden", 403);
        }
      }

      const unit = await OrganizationalUnit.findByPk(unit_id, { transaction });
      if (!unit) {
        throw new AppError("Branch / unit not found", 400);
      }
      if (String(unit.org_id) !== String(orgId)) {
        throw new AppError("That branch does not belong to the selected organization", 400);
      }
    }

    const role = await Role.findByPk(role_id, { transaction });
    if (!role) {
      throw new AppError("Role not found", 400);
    }
    if (role.org_id && String(role.org_id) !== String(orgId)) {
      throw new AppError("That role does not belong to the selected organization", 400);
    }

    if (deptId) {
      const dept = await Department.findByPk(deptId, { transaction });
      if (!dept) {
        throw new AppError("Department not found", 400);
      }
      if (String(dept.org_id) !== String(orgId)) {
        throw new AppError("Department does not belong to the selected organization", 400);
      }
      const deptUnitId = dept.unit_id ? String(dept.unit_id) : "null";
      const targetUnitId = unit_id ? String(unit_id) : "null";
      if (deptUnitId !== targetUnitId) {
        throw new AppError("The assigned department does not belong to the assigned branch. Department and branch must match.", 400);
      }
    }

    await UserAssignment.destroy({ where: { user_id: target.user_id }, transaction });

    target.org_id = orgId || null;
    target.dept_id = deptId || null;
    target.unit_id = unit_id || null;
    target.status = "ACTIVE";
    await target.save({ transaction });

    await UserAssignment.create(
      {
        user_id: target.user_id,
        unit_id: unit_id || null,
        role_id,
      },
      { transaction }
    );

    // Triggered campaign automation for approved users
    try {
      const gamificationService = require("./gamificationService");
      await gamificationService.triggerAssignmentsForUser(target, transaction);
    } catch (err) {
      console.error("Failed to run campaign triggers for approved applicant:", err);
    }

    await transaction.commit();

    return User.findByPk(targetUserId, {
      attributes: { exclude: ["password"] },
    });
  } catch (error) {
    await transaction.rollback();
    if (error instanceof AppError) throw error;
    throw new AppError(error.message || "Unable to approve applicant", 500);
  }
};

/**
 * Reject / remove a pending applicant (UNASSIGNED only). Same visibility as pending list.
 */
const rejectApplicantService = async (actor, targetUserId) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await User.findByPk(targetUserId, { transaction });
    if (!user) {
      throw new AppError("errors.user_not_found", 404);
    }
    if (user.status !== "UNASSIGNED") {
      throw new AppError("Only pending registrations can be rejected this way", 400);
    }

    const actorRoleName = actor.role?.name;
    const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      if (user.org_id && String(user.org_id) !== String(actor.org_id)) {
        throw new AppError("Forbidden", 403);
      }
    } else if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
      const orgOk = !user.org_id || String(user.org_id) === String(actor.org_id);
      const deptOk = !user.dept_id || String(user.dept_id) === String(actor.dept_id);
      if (!orgOk || !deptOk) {
        throw new AppError("Forbidden", 403);
      }
    } else if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      const orgOk = !user.org_id || String(user.org_id) === String(actor.org_id);
      const isUnderSubtree = !user.unit_id || (await unitService.isDescendantOf(user.unit_id, actor.unit_id, actor.org_id));
      if (!orgOk || !isUnderSubtree) {
        throw new AppError("Forbidden", 403);
      }
    } else if (!isPlatformAdmin && !actor.isSuperAdmin) {
      throw new AppError("Forbidden", 403);
    }

    // Save to RegistrationRejectionLog for audit history before deleting
    await RegistrationRejectionLog.create({
      first_name: user.first_name,
      last_name: user.last_name,
      phone_number: user.phone_number,
      email: user.email,
      org_id: user.org_id,
      unit_id: user.unit_id,
      dept_id: user.dept_id,
      rejected_by: actor.user_id,
      rejection_reason: "Registration request rejected by administrator via pending registrations portal",
    }, { transaction });

    await UserAssignment.destroy({ where: { user_id: targetUserId }, transaction });
    await LoginLog.destroy({ where: { user_id: targetUserId }, transaction });
    await user.destroy({ transaction });

    await transaction.commit();
    return { success: true };
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};



const getUserLoginInfoService = async (userId) => {
  try {
    const successCount = await LoginLog.count({
      where: { user_id: userId, status: "SUCCESS" },
    });

    const failedCount = await LoginLog.count({
      where: { user_id: userId, status: "FAILED" },
    });

    const lastSuccess = await LoginLog.findOne({
      where: { user_id: userId, status: "SUCCESS" },
      order: [["createdAt", "DESC"]],
      attributes: ["id", ["createdAt", "login_at"], "ip_address", "user_agent"],
    });

    const lastFailed = await LoginLog.findOne({
      where: { user_id: userId, status: "FAILED" },
      order: [["createdAt", "DESC"]],
      attributes: ["id", ["createdAt", "login_at"], "ip_address", "user_agent", "failure_reason"],
    });

    // Recent history (last 5 attempts)
    const recentHistory = await LoginLog.findAll({
      where: { user_id: userId },
      order: [["createdAt", "DESC"]],
      limit: 5,
      attributes: ["id", ["createdAt", "login_at"], "ip_address", "user_agent", "status", "failure_reason"],
    });

    return {
      success_count: successCount,
      failed_count: failedCount,
      last_successful_login: lastSuccess,
      last_failed_login: lastFailed,
      recent_history: recentHistory
    };
  } catch (error) {
    console.error("Error in getUserLoginInfoService:", error);
    throw new AppError("Unable to fetch login information", 500);
  }
};

const deleteUserService = async (userId) => {
  const transaction = await User.sequelize.transaction();
  try {
    const user = await User.findByPk(userId, { transaction });

    if (!user) {
      throw new AppError("errors.user_not_found", 404);
    }

    if (user.status !== "UNASSIGNED") {
      throw new AppError("errors.cannot_delete_assigned_user", 400);
    }

    // Cleanup associated records that might exist for unassigned users
    // (In practice, unassigned shouldn't have many, but it's safer)
    await UserAssignment.destroy({ where: { user_id: userId }, transaction });
    await LoginLog.destroy({ where: { user_id: userId }, transaction });

    // Hard delete the user
    await user.destroy({ transaction });

    await transaction.commit();
    return { success: true };
  } catch (error) {
    if (transaction) await transaction.rollback();
    throw error;
  }
};

const deactivateUserService = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  user.status = "DEACTIVATED";
  await user.save();

  return { success: true };
};

const activateUserService = async (userId) => {
  const user = await User.findByPk(userId);

  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }

  user.status = "ACTIVE";
  await user.save();

  return { success: true };
};

const adminUpdateUserScopeService = async (actorModel, targetUserId, body) => {
  const { org_id: orgIn, dept_id: deptIn, role_id } = body;
  const actorRoleName = actorModel.role?.name;
  const isPlatformAdmin = actorModel.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  const user = await User.findByPk(targetUserId);
  if (!user) {
    throw new AppError("errors.user_not_found", 404);
  }
  
  const targetIsPlatformAdmin = user.org_id === null;

  if (targetIsPlatformAdmin && !isPlatformAdmin) {
    throw new AppError("Cannot change platform superadmin via this action", 400);
  }

  if (!isPlatformAdmin && !actorModel.isSuperAdmin) {
    if (!actorModel.org_id) {
      throw new AppError("Forbidden", 403);
    }
    if (user.org_id !== actorModel.org_id) {
      throw new AppError("User is not in your organization", 403);
    }
  }

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    if (orgIn !== undefined && orgIn !== null && orgIn !== "" && orgIn !== actorModel.org_id) {
      throw new AppError("Cannot move users to another organization", 403);
    }
    if (deptIn) {
      const dept = await Department.findByPk(deptIn);
      if (dept && dept.unit_id !== null) {
        throw new AppError("Forbidden: Organization administrators cannot assign users to branch-level departments.", 403);
      }
    }
  }

  if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    if (!actorModel.dept_id) {
      throw new AppError("Your account has no department scope", 403);
    }
    if (deptIn !== undefined && deptIn !== null && deptIn !== "" && deptIn !== actorModel.dept_id) {
      throw new AppError("You can only assign users to your own department", 403);
    }
    if (user.dept_id && user.dept_id !== actorModel.dept_id) {
      throw new AppError(
        "This user belongs to another department. Ask an org admin to transfer them.",
        403
      );
    }
  }

  const hasOrg = orgIn !== undefined;
  const hasDept = deptIn !== undefined;

  const norm = (v) => (v === "" || v === null ? null : v);

  let newOrg = hasOrg ? norm(orgIn) : user.org_id;
  let newDept = hasDept ? norm(deptIn) : user.dept_id;

  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME || actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    newOrg = actorModel.org_id;
  }

  if (hasOrg && !newOrg) {
    newDept = null;
  }

  if (newDept) {
    const dept = await Department.findByPk(newDept);
    if (!dept) {
      throw new AppError("Invalid department", 400);
    }
    if (!newOrg) {
      newOrg = dept.org_id;
    } else if (dept.org_id !== newOrg) {
      throw new AppError("Department does not belong to the selected organization", 400);
    }
  }

  if (isPlatformAdmin && hasOrg) {
    user.org_id = newOrg;
  } else if (isPlatformAdmin && hasDept && newOrg && user.org_id !== newOrg) {
    user.org_id = newOrg;
  }
  if (hasDept) user.dept_id = newDept;
  if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    user.unit_id = null;
  }

  await user.save();

  if (role_id !== undefined) {
    if (role_id === null || role_id === "") {
      await UserAssignment.destroy({ where: { user_id: user.user_id } });
    } else {
      const matchedRole = await Role.findByPk(role_id);
      if (!matchedRole) {
        throw new AppError("Invalid role selected", 400);
      }
      await UserAssignment.destroy({ where: { user_id: user.user_id } });
      await UserAssignment.create({
        user_id: user.user_id,
        unit_id: user.unit_id || null,
        role_id: matchedRole.id,
      });
    }
  }

  return user;
};

const getRegistrationRejectionLogsService = async (actor) => {
  if (!actor) {
    throw new AppError("Unauthorized", 401);
  }

  const where = {};

  const actorRoleName = actor.role?.name;
  const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

  if (isPlatformAdmin || actor.isSuperAdmin) {
    // all logs
  } else if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
    where.org_id = actor.org_id;
  } else if (actorRoleName === DEPT_ADMIN_BASELINE_ROLE_NAME) {
    where.org_id = actor.org_id;
    where.dept_id = actor.dept_id;
  } else if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
    where.org_id = actor.org_id;
    const subUnits = await unitService.getSubtreeIds(actor.unit_id, actor.org_id);
    where.unit_id = { [Op.in]: [actor.unit_id, ...subUnits] };
  } else {
    throw new AppError("Forbidden: You do not have the required administrative role.", 403);
  }

  return RegistrationRejectionLog.findAll({
    where,
    order: [["rejected_at", "DESC"]],
  });
};

module.exports = {
  registerApplicantService,
  registerUserService,
  loginService,
  getAllUsersService,
  updateUserService,
  updatePasswordService,
  resetEmailPasswordService,
  resetPasswordService,
  resetUserPasswordService,
  resetUserPasswordByIdService,
  adminResetUserPasswordByIdService,
  adminDeactivateUserService,
  adminActivateUserService,
  updateLanguagePreferenceService,
  getUserByIdService,
  getUserByPhoneService,
  getAllUsersWithPendingService,
  approveApplicantService,
  rejectApplicantService,
  getUserLoginInfoService,
  deleteUserService,
  deactivateUserService,
  activateUserService,
  adminUpdateUserScopeService,
  getRegistrationRejectionLogsService,
};
