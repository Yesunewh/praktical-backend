const { Permission, PermissionAllocation, OrganizationalUnit } = require("../models");
const { Op } = require("sequelize");
const { hiddenPermissionNamesForRole, SUPERADMIN_ONLY } = require("../config/permissionTiers");
const { LEGACY_PERMISSION_NAMES } = require("../config/legacyPermissionsRemove");
const { applyMatrixLockedForEditorMetadata, SUPER_ADMIN_BASELINE_ROLE_NAME, ORG_ADMIN_BASELINE_ROLE_NAME } = require("../config/permissionMatrixBaselines");

const legacyPermissionNameSet = new Set(LEGACY_PERMISSION_NAMES);

class PermissionService {
  async pushPermission(data) {
    // Only SuperAdmins use this. Creates fixed permission in DB.
    return await Permission.create(data);
  }

  async allocatePermission(permissionId, type, targetId = null, effect = "GRANT", actor = {}) {
    const actorRoleName = actor.role?.name;
    const isPlatformAdmin = actor.org_id === null && actorRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME;

    if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      throw new Error(
        "Organization administrators have read-only access to the permission matrix; allocations cannot be changed."
      );
    }
    if (!isPlatformAdmin) {
      if (effect !== "DENY" || type !== "UNIT") {
        throw new Error("Admins can ONLY restrict (DENY) capabilities to specific branches.");
      }
      const targetUnit = await OrganizationalUnit.findByPk(targetId);
      if (!targetUnit || targetUnit.org_id !== actor.org_id) {
        throw new Error("Target branch is invalid or out of your organizational scope.");
      }
    }

    // Toggle Logic for Organization/System level
    if (type === "ORGANIZATION" || type === "SYSTEM") {
      const existing = await PermissionAllocation.findOne({
        where: {
          permission_id: permissionId,
          allocation_type: type,
          allocation_id: targetId,
          effect: effect || "GRANT"
        }
      });

      if (existing) {
        await existing.destroy();
        return { deleted: true };
      }
    }

    return await PermissionAllocation.create({
      permission_id: permissionId,
      allocation_type: type,
      allocation_id: targetId,
      effect: effect || "GRANT"
    });
  }

  async bulkAllocateToOrg(orgId, effect = "GRANT", options = {}) {
    const { transaction } = options;

    // 1. Clear existing allocations for this Org
    await PermissionAllocation.destroy({
      where: {
        allocation_type: "ORGANIZATION",
        allocation_id: orgId
      },
      transaction
    });

    // 2. If GRANT, create new records for all permissions
    if (effect === "GRANT") {
      const allPermissions = await Permission.findAll({ transaction });
      const allocations = allPermissions.map(p => ({
        permission_id: p.id,
        allocation_type: "ORGANIZATION",
        allocation_id: orgId,
        effect: "GRANT"
      }));

      return await PermissionAllocation.bulkCreate(allocations, { transaction });
    }

    return { cleared: true };
  }

  /**
   * Idempotent: add missing ORGANIZATION GRANT rows for every Permission.
   * Fixes legacy orgs (created before auto-bulk) and new Permission rows added after bulkAllocateToOrg.
   */
  async ensureOrgPermissionPool(orgId) {
    if (!orgId) return;

    const allPerms = await Permission.findAll({ attributes: ["id"] });
    if (allPerms.length === 0) return;

    const existingRows = await PermissionAllocation.findAll({
      where: {
        allocation_type: "ORGANIZATION",
        allocation_id: orgId,
        effect: "GRANT",
      },
      attributes: ["permission_id"],
      raw: true,
    });
    const existing = new Set(existingRows.map((r) => String(r.permission_id)));
    const missing = allPerms.filter((p) => !existing.has(String(p.id)));

    for (const p of missing) {
      await PermissionAllocation.findOrCreate({
        where: {
          permission_id: p.id,
          allocation_type: "ORGANIZATION",
          allocation_id: orgId,
          effect: "GRANT",
        },
        defaults: {
          permission_id: p.id,
          allocation_type: "ORGANIZATION",
          allocation_id: orgId,
          effect: "GRANT",
        },
      });
    }
  }

  /**
   * @param {string|null|undefined} orgId
   * @param {string|null|undefined} unitId
   * @param {string|null|undefined} requesterRoleName - masks platform / org-only permissions per tier
   */
  async getAvailablePermissions(orgId, unitId, requesterRoleName = null) {
    if (orgId) {
      await this.ensureOrgPermissionPool(orgId);
    }

    let allPermissions = await Permission.findAll({ raw: true });
    allPermissions = allPermissions.filter((p) => p.name && !legacyPermissionNameSet.has(p.name));
    const hiddenNames = hiddenPermissionNamesForRole(requesterRoleName);

    // Collect conditions to see what they are allowed
    const orConditions = [{ allocation_type: "SYSTEM" }];
    
    if (orgId) {
      orConditions.push({ allocation_type: "ORGANIZATION", allocation_id: orgId });
    }
    
    let unitPathIds = [];
    if (unitId) {
      let currentUnit = await OrganizationalUnit.findByPk(unitId);
      while (currentUnit) {
        unitPathIds.push(currentUnit.id);
        currentUnit = currentUnit.parent_id ? await OrganizationalUnit.findByPk(currentUnit.parent_id) : null;
      }
      if (unitPathIds.length > 0) {
        orConditions.push({
          allocation_type: "UNIT",
          allocation_id: { [Op.in]: unitPathIds },
        });
      }
    }

    const allocations = await PermissionAllocation.findAll({
      where: {
        [Op.or]: orConditions
      },
      raw: true
    });

    const grantedIds = new Set(
      allocations.filter((a) => a.effect === "GRANT").map((a) => String(a.permission_id))
    );
    const deniedIds = new Set(
      allocations.filter((a) => a.effect === "DENY").map((a) => String(a.permission_id))
    );

    const rows = allPermissions.map((p) => {
      const allocated = grantedIds.has(String(p.id)) && !deniedIds.has(String(p.id));
      const tierBlocked = p.name && hiddenNames.has(p.name);
      return {
        ...p,
        has_access: allocated && !tierBlocked,
      };
    });

    const filtered = orgId
      ? rows.filter((p) => p.name && !SUPERADMIN_ONLY.has(p.name))
      : rows;
    return applyMatrixLockedForEditorMetadata(filtered, requesterRoleName);
  }
}

module.exports = new PermissionService();
