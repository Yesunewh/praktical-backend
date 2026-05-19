/**
 * Resolves JWT permission names from global baseline Roles (org_id null) synced on server boot.
 * Used when assignments yield zero permissions — keeps login aligned with `/admin/roles` baselines.
 */
const { Role, Permission } = require("../models");
const { Op } = require("sequelize");

/**
 * Permissions that are ONLY available at the Organization Admin level.
 * All Branch Admins (at any level) retain MANAGE_HIERARCHY to support the
 * cascading delegation model: every Branch Admin can create one level below.
 */
const LEVEL_1_ONLY_PERMISSIONS = Object.freeze([
  // MANAGE_HIERARCHY is intentionally NOT restricted here.
  // All Branch Admins can manage one level below their own unit.
]);

/**
 * Strips level-restricted permissions from a Branch Admin's permission list.
 * Currently no permissions are stripped since MANAGE_HIERARCHY is available at all levels.
 * This function remains as the hook for future level-specific restrictions.
 *
 * @param {string[]} permissionNames  Raw permission list from role DB record
 * @param {number|null} unitLevel     The `level` field from the UnitType of the user's OrganizationalUnit
 * @returns {string[]}                Scoped permission list for the JWT
 */
function scopePermissionsForBranchAdminLevel(permissionNames, unitLevel) {
  if (!permissionNames || !permissionNames.length) return permissionNames;
  // Strip any org-level-only permissions from all branch admins regardless of level
  return permissionNames.filter(p => !LEVEL_1_ONLY_PERMISSIONS.includes(p));
}

/**
 * @param {string} roleName Canonical role name matching systemBaselineRoles / defaultLearnerPermissions
 * @returns {Promise<string[]|null>} Permission names sorted, or null if role missing or has no linked permissions.
 */
async function getBaselinePermissionNamesForLogin(roleName) {
  const roleRow = await Role.findOne({
    where: {
      name: roleName,
      org_id: { [Op.is]: null },
    },
    include: [
      {
        model: Permission,
        attributes: ["name"],
        through: { attributes: [] },
      },
    ],
  });
  const rows = roleRow?.Permissions ?? [];
  if (!rows.length) return null;
  const names = rows.map((p) => p.name).filter(Boolean);
  return [...new Set(names)].sort((a, b) => String(a).localeCompare(String(b)));
}

module.exports = { getBaselinePermissionNamesForLogin, scopePermissionsForBranchAdminLevel, LEVEL_1_ONLY_PERMISSIONS };
