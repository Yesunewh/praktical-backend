const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { Role, RolePermission, Permission } = require("../models");
const permissionService = require("./permissionService");
const {
  hiddenPermissionNamesForUserType,
  roleContainsHiddenPermission,
} = require("../config/permissionTiers");
const { BASELINE_ROLE_DISPLAY_ORDER } = require("../config/systemBaselineRoles");
const {
  PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS,
  shouldMatrixLockLearnerPreviewForEditor,
} = require("../config/permissionMatrixBaselines");

function sortRolesForDisplay(roles) {
  const rank = (name) => {
    const i = BASELINE_ROLE_DISPLAY_ORDER.indexOf(String(name));
    return i >= 0 ? i : BASELINE_ROLE_DISPLAY_ORDER.length;
  };
  return [...roles].sort((a, b) => {
    const d = rank(a.name) - rank(b.name);
    if (d !== 0) return d;
    return String(a.name || "").localeCompare(String(b.name || ""));
  });
}

async function assertPermissionsAllowedForUserType(permissionIds, requesterUserType) {
  if (!permissionIds?.length || !requesterUserType || requesterUserType === "SUPERADMIN") {
    return;
  }
  const hidden = hiddenPermissionNamesForUserType(requesterUserType);
  if (hidden.size === 0) return;
  const rows = await Permission.findAll({
    where: { id: permissionIds },
    attributes: ["name"],
    raw: true,
  });
  for (const row of rows) {
    if (row.name && hidden.has(row.name)) {
      throw new Error(`Permission "${row.name}" is not available at your administrator level.`);
    }
  }
}

/**
 * Phase 2: tenant ORG/UNIT/DEPT editors must keep matrix-locked learner preview perms on org-scoped roles.
 * Merges PLAY_CHALLENGES and VIEW_REMEDIATION when they are allowed for the editor (has_access in pool).
 */
async function mergeTenantRolePermissionIdsWithLockedPreview(
  permissionIds,
  orgId,
  unitId,
  requesterUserType,
  isSuperadmin
) {
  if (isSuperadmin || !orgId || !shouldMatrixLockLearnerPreviewForEditor(requesterUserType)) {
    return permissionIds || [];
  }
  const rows = await permissionService.getAvailablePermissions(orgId, unitId, requesterUserType);
  const byName = new Map();
  for (const row of rows) {
    if (row.has_access && row.name) {
      byName.set(row.name, String(row.id));
    }
  }
  const set = new Set((permissionIds || []).map(String));
  for (const name of PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS) {
    const id = byName.get(name);
    if (id) set.add(id);
  }
  return [...set];
}

class RoleService {
  /**
   * Updates a role. Tenant roles (org_id set): org/unit admins or superadmin.
   * System roles (org_id null): superadmin only; name cannot be changed.
   */
  async updateCustomRole(roleId, { name, description, permissionIds }, actorOrgId, unitId, options = {}) {
    const { isSuperadmin = false, requesterUserType = null } = options;
    const role = await Role.findByPk(roleId);
    if (!role) {
      throw new Error("Role not found.");
    }

    if (!role.org_id) {
      if (!isSuperadmin) {
        throw new Error("System roles cannot be modified.");
      }
      if (name !== undefined && name !== null && String(name).trim() !== String(role.name)) {
        throw new Error("System baseline role names cannot be renamed.");
      }
      const shouldReplacePermissions = permissionIds !== undefined;
      const rawIds =
        shouldReplacePermissions && Array.isArray(permissionIds) ? permissionIds.map((pid) => String(pid)) : [];
      if (rawIds.length > 0) {
        const found = await Permission.findAll({
          where: { id: { [Op.in]: rawIds } },
          attributes: ["id"],
          raw: true,
        });
        const foundIds = new Set(found.map((r) => String(r.id)));
        for (const id of rawIds) {
          if (!foundIds.has(String(id))) {
            throw new Error(`Permission ${id} is invalid or does not exist.`);
          }
        }
      }

      const transaction = await sequelize.transaction();
      try {
        if (description !== undefined) {
          await role.update({ description: description === null ? null : String(description) }, { transaction });
        }
        if (shouldReplacePermissions) {
          await RolePermission.destroy({ where: { role_id: role.id }, transaction });
          if (rawIds.length > 0) {
            await RolePermission.bulkCreate(
              rawIds.map((permission_id) => ({
                role_id: role.id,
                permission_id,
              })),
              { transaction }
            );
          }
        }
        await transaction.commit();
      } catch (e) {
        await transaction.rollback();
        throw e;
      }
      return Role.findByPk(role.id, {
        include: [{ model: Permission }],
      });
    }

    if (!isSuperadmin) {
      if (!actorOrgId || String(role.org_id) !== String(actorOrgId)) {
        throw new Error("You cannot modify this role.");
      }
    }

    const effectiveOrgId = role.org_id;
    const tierUser = isSuperadmin ? "SUPERADMIN" : requesterUserType;

    /** @type {string[] | undefined} */
    let mergedForSave = permissionIds;
    if (permissionIds !== undefined) {
      mergedForSave = await mergeTenantRolePermissionIdsWithLockedPreview(
        permissionIds,
        effectiveOrgId,
        unitId,
        requesterUserType,
        isSuperadmin
      );
    }

    const allowed = await permissionService.getAvailablePermissions(effectiveOrgId, unitId, tierUser);
    const allowedMap = new Map(allowed.map((p) => [String(p.id), p.has_access]));

    if (mergedForSave !== undefined) {
      if (mergedForSave.length > 0) {
        if (!isSuperadmin) {
          await assertPermissionsAllowedForUserType(mergedForSave, requesterUserType);
        }
        for (const pid of mergedForSave) {
          if (!allowedMap.get(String(pid))) {
            throw new Error(`Permission ${pid} is locked or does not exist for this scope.`);
          }
        }
      }
    }

    const transaction = await sequelize.transaction();
    try {
      await role.update(
        {
          ...(name !== undefined ? { name } : {}),
          ...(description !== undefined ? { description } : {}),
        },
        { transaction }
      );

      await RolePermission.destroy({ where: { role_id: role.id }, transaction });

      if (mergedForSave !== undefined && mergedForSave.length > 0) {
        await RolePermission.bulkCreate(
          mergedForSave.map((pid) => ({
            role_id: role.id,
            permission_id: pid,
          })),
          { transaction }
        );
      }

      await transaction.commit();
    } catch (e) {
      await transaction.rollback();
      throw e;
    }

    return Role.findByPk(role.id, {
      include: [{ model: Permission }],
    });
  }

  async createCustomRole(orgId, unitId, name, description, permissionIds, options = {}) {
    const { isSuperadmin = false, requesterUserType = null } = options;
    if (!orgId && !isSuperadmin) {
      throw new Error("Organization ID is required to create a custom role.");
    }

    let mergedCreateIds = permissionIds || [];
    if (orgId) {
      mergedCreateIds = await mergeTenantRolePermissionIdsWithLockedPreview(
        mergedCreateIds,
        orgId,
        unitId,
        requesterUserType,
        isSuperadmin
      );
      const tierUser = isSuperadmin ? "SUPERADMIN" : requesterUserType;
      const allowed = await permissionService.getAvailablePermissions(orgId, unitId, tierUser);
      const allowedMap = new Map(allowed.map((p) => [String(p.id), p.has_access]));

      if (mergedCreateIds.length > 0) {
        if (!isSuperadmin) {
          await assertPermissionsAllowedForUserType(mergedCreateIds, requesterUserType);
        }
        for (const pid of mergedCreateIds) {
          if (!allowedMap.get(String(pid))) {
            throw new Error(`Permission ${pid} is locked or does not exist for this scope.`);
          }
        }
      }
    } else if (permissionIds && permissionIds.length > 0) {
      const found = await Permission.findAll({
        where: { id: permissionIds },
        attributes: ["id"],
        raw: true,
      });
      if (found.length !== permissionIds.length) {
        throw new Error("One or more permission IDs are invalid.");
      }
    }

    const role = await Role.create({ name, description, org_id: orgId ?? null });

    if (orgId ? mergedCreateIds.length > 0 : permissionIds && permissionIds.length > 0) {
      const idsToWrite = orgId ? mergedCreateIds : permissionIds;
      const rolePerms = idsToWrite.map((pid) => ({
        role_id: role.id,
        permission_id: pid,
      }));
      await RolePermission.bulkCreate(rolePerms);
    }

    return role;
  }

  async getRoles(orgId, includeSystem = true, requesterUserType = null) {
    let roles;
    if (!orgId) {
      const where = includeSystem ? {} : { org_id: { [Op.is]: null } };
      roles = await Role.findAll({ where, include: [{ model: Permission }] });
    } else {
      const whereClause = includeSystem
        ? { [Op.or]: [{ org_id: orgId }, { org_id: { [Op.is]: null } }] }
        : { org_id: orgId };
      roles = await Role.findAll({ where: whereClause, include: [{ model: Permission }] });
    }

    const hidden = hiddenPermissionNamesForUserType(requesterUserType);
    if (hidden.size === 0) {
      return sortRolesForDisplay(roles);
    }
    return sortRolesForDisplay(roles.filter((r) => !roleContainsHiddenPermission(r, hidden)));
  }
}

module.exports = new RoleService();
