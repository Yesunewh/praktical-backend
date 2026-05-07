/**
 * Which permission *names* are masked when listing assignable permissions and validating
 * role create/update for a given actor user_type (docs/PERMISSION_TEMPLATES_MATRIX.md combined table).
 *
 * SUPERADMIN: no masking.
 * ORG_ADMIN: platform-only (MANAGE_TENANTS, MANAGE_SYSTEM).
 * UNIT_ADMIN (Branch): matrix column ⬜ — may not assign those to roles.
 * DEPT_ADMIN: matrix column ⬜.
 * STAFF / EXTERNAL: only learner-surface permissions may appear in role builder (all others hidden).
 */

const {
  ALL_MATRIX_PERMISSION_NAMES,
  STAFF_LEARNER_BASELINE_PERMISSION_NAMES,
} = require("./permissionMatrixBaselines");

const SUPERADMIN_ONLY = new Set(["MANAGE_TENANTS", "MANAGE_SYSTEM"]);

/** Branch Admin assigner — column ⬜ for these */
const UNIT_ADMIN_HIDDEN = new Set([
  ...SUPERADMIN_ONLY,
  "MANAGE_EXAMS",
  "MANAGE_TERMINOLOGY",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
]);

/** Department Head assigner — column ⬜ for these */
const DEPT_ADMIN_HIDDEN = new Set([
  ...SUPERADMIN_ONLY,
  "MANAGE_DEPARTMENTS",
  "MANAGE_TERMINOLOGY",
  "MANAGE_HIERARCHY",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
]);

const learnerNameSet = new Set(STAFF_LEARNER_BASELINE_PERMISSION_NAMES);
const STAFF_EXTERNAL_ASSIGNER_HIDDEN = new Set(
  ALL_MATRIX_PERMISSION_NAMES.filter((n) => !learnerNameSet.has(n))
);

/**
 * @param {string | undefined | null} userType
 * @returns {Set<string>}
 */
function hiddenPermissionNamesForUserType(userType) {
  if (!userType || userType === "SUPERADMIN") {
    return new Set();
  }
  if (userType === "ORG_ADMIN") {
    return new Set(SUPERADMIN_ONLY);
  }
  if (userType === "UNIT_ADMIN") {
    return new Set(UNIT_ADMIN_HIDDEN);
  }
  if (userType === "DEPT_ADMIN") {
    return new Set(DEPT_ADMIN_HIDDEN);
  }
  return new Set(STAFF_EXTERNAL_ASSIGNER_HIDDEN);
}

/**
 * Role is hidden if it grants any permission name in `hidden`.
 * @param {{ Permissions?: { name: string }[] }} role
 * @param {Set<string>} hidden
 */
function roleContainsHiddenPermission(role, hidden) {
  const perms = role.Permissions || [];
  for (const p of perms) {
    if (hidden.has(p.name)) return true;
  }
  return false;
}

module.exports = {
  SUPERADMIN_ONLY,
  UNIT_ADMIN_HIDDEN,
  DEPT_ADMIN_HIDDEN,
  STAFF_EXTERNAL_ASSIGNER_HIDDEN,
  hiddenPermissionNamesForUserType,
  roleContainsHiddenPermission,
};
