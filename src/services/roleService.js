const { Op } = require("sequelize");
const sequelize = require("../config/database");
const { Role, RolePermission, Permission } = require("../models");
const permissionService = require("./permissionService");
const {
  hiddenPermissionNamesForRole,
  roleContainsHiddenPermission,
} = require("../config/permissionTiers");
const {
  BASELINE_ROLE_DISPLAY_ORDER,
  ORG_ADMIN_BASELINE_ROLE_DESCRIPTION,
  BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION,
  DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");
const {
  BASELINE_NAME_TO_PERMISSIONS,
  LEARNER_BASELINE_ROLE_NAME,
  shouldMatrixLockLearnerPreviewForEditor,
  PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS,
} = require("../config/permissionMatrixBaselines");
const {
  DEFAULT_LEARNER_ROLE_DESCRIPTION,
} = require("../config/defaultLearnerPermissions");

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

async function assertPermissionsAllowedForRole(permissionIds, requesterRoleName) {
  if (!permissionIds?.length || !requesterRoleName || requesterRoleName === SUPER_ADMIN_BASELINE_ROLE_NAME) {
    return;
  }
  const hidden = hiddenPermissionNamesForRole(requesterRoleName);
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
  requesterRoleName,
  isSuperadmin
) {
  if (isSuperadmin || !orgId || !shouldMatrixLockLearnerPreviewForEditor(requesterRoleName)) {
    return permissionIds || [];
  }
  const rows = await permissionService.getAvailablePermissions(orgId, unitId, requesterRoleName);
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
    const { isSuperadmin = false, requesterRoleName = null } = options;
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

    /** @type {string[] | undefined} */
    let mergedForSave = permissionIds;
    if (permissionIds !== undefined) {
      mergedForSave = await mergeTenantRolePermissionIdsWithLockedPreview(
        permissionIds,
        effectiveOrgId,
        unitId,
        requesterRoleName,
        isSuperadmin
      );
    }

    const allowed = await permissionService.getAvailablePermissions(effectiveOrgId, unitId, requesterRoleName);
    const allowedMap = new Map(allowed.map((p) => [String(p.id), p.has_access]));

    if (mergedForSave !== undefined) {
      if (mergedForSave.length > 0) {
        if (!isSuperadmin) {
          await assertPermissionsAllowedForRole(mergedForSave, requesterRoleName);
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
    const { isSuperadmin = false, requesterRoleName = null } = options;
    if (!orgId && !isSuperadmin) {
      throw new Error("Organization ID is required to create a custom role.");
    }

    let mergedCreateIds = permissionIds || [];
    if (orgId) {
      mergedCreateIds = await mergeTenantRolePermissionIdsWithLockedPreview(
        mergedCreateIds,
        orgId,
        unitId,
        requesterRoleName,
        isSuperadmin
      );
      const allowed = await permissionService.getAvailablePermissions(orgId, unitId, requesterRoleName);
      const allowedMap = new Map(allowed.map((p) => [String(p.id), p.has_access]));

      if (mergedCreateIds.length > 0) {
        if (!isSuperadmin) {
          await assertPermissionsAllowedForRole(mergedCreateIds, requesterRoleName);
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

  async getRoles(orgId, includeSystem = true, requesterRoleName = null) {
    let roles;
    const permissionInclude = {
      model: Permission,
      attributes: ["id", "name", "description"],
      through: { attributes: [] } // Omits the verbose RolePermission pivot table from the output
    };

    if (!orgId) {
      // If no orgId is provided, only return global/system roles.
      const where = { org_id: { [Op.is]: null } };
      roles = await Role.findAll({ where, include: [permissionInclude] });
    } else {
      const whereClause = includeSystem
        ? { [Op.or]: [{ org_id: orgId }, { org_id: { [Op.is]: null } }] }
        : { org_id: orgId };
      roles = await Role.findAll({ where: whereClause, include: [permissionInclude] });
    }

    const hidden = hiddenPermissionNamesForRole(requesterRoleName);
    if (hidden.size === 0) {
      return sortRolesForDisplay(roles);
    }
    return sortRolesForDisplay(
      roles.filter((r) => {
        // Never filter out the Department Admin, Branch Admin, or Learner baseline roles for hierarchical assignment
        if (
          r.name === DEPT_ADMIN_BASELINE_ROLE_NAME ||
          r.name === BRANCH_UNIT_BASELINE_ROLE_NAME ||
          r.name === "Learner" ||
          r.name === LEARNER_BASELINE_ROLE_NAME
        ) {
          return true;
        }
        return !roleContainsHiddenPermission(r, hidden);
      })
    );
  }

  async seedOrganizationRoles(orgId, externalTransaction = null) {
    if (!orgId) throw new Error("orgId is required for seeding.");

    const transaction = externalTransaction || await sequelize.transaction();
    try {
      // Descriptions mapping
      const descriptions = {
        "Organization Admin": ORG_ADMIN_BASELINE_ROLE_DESCRIPTION,
        "Branch Admin": BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION,
        "Department Admin": DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION,
        [LEARNER_BASELINE_ROLE_NAME]: DEFAULT_LEARNER_ROLE_DESCRIPTION,
      };

      for (const [roleName, permissionNames] of Object.entries(BASELINE_NAME_TO_PERMISSIONS)) {
        // Skip Super Admin for organizations
        if (roleName === "Super Admin") continue;

        // 1. Create the Role for the Organization
        const role = await Role.create({
          name: roleName,
          description: descriptions[roleName] || `Standard ${roleName} role.`,
          org_id: orgId
        }, { transaction });

        // 2. Find the Permission IDs
        const perms = await Permission.findAll({
          where: { name: { [Op.in]: permissionNames } },
          attributes: ["id"],
          transaction
        });

        // 3. Link them
        if (perms.length > 0) {
          await RolePermission.bulkCreate(
            perms.map(p => ({
              role_id: role.id,
              permission_id: p.id
            })),
            { transaction }
          );
        }
      }

      if (!externalTransaction) await transaction.commit();
      console.log(`--- Seeded 4 baseline roles for Org ${orgId} ---`);
    } catch (error) {
      if (!externalTransaction) await transaction.rollback();
      console.error("Error seeding organization roles:", error);
      throw error;
    }
  }
}

module.exports = new RoleService();
