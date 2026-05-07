/**
 * Resolves JWT permission names from global baseline Roles (org_id null) synced on server boot.
 * Used when assignments yield zero permissions — keeps login aligned with `/admin/roles` baselines.
 */
const { Role, Permission } = require("../models");
const { Op } = require("sequelize");

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

module.exports = { getBaselinePermissionNamesForLogin };
