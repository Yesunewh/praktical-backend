const { Op } = require("sequelize");
const {
  Permission,
  RolePermission,
  UserPermission,
  PermissionAllocation,
} = require("../models");
const { LEGACY_PERMISSION_NAMES } = require("../config/legacyPermissionsRemove");

/**
 * Deletes legacy permission rows and dependent RolePermission / UserPermission / PermissionAllocation.
 * @returns {Promise<number>} count of Permission rows removed
 */
async function purgeLegacyPermissions() {
  const legacyPerms = await Permission.findAll({
    where: { name: LEGACY_PERMISSION_NAMES },
    attributes: ["id"],
  });
  const legacyIds = legacyPerms.map((p) => p.id);
  if (legacyIds.length === 0) return 0;

  await RolePermission.destroy({ where: { permission_id: { [Op.in]: legacyIds } } });
  await UserPermission.destroy({ where: { permission_id: { [Op.in]: legacyIds } } });
  await PermissionAllocation.destroy({ where: { permission_id: { [Op.in]: legacyIds } } });
  await Permission.destroy({ where: { id: { [Op.in]: legacyIds } } });
  return legacyIds.length;
}

module.exports = { purgeLegacyPermissions };
