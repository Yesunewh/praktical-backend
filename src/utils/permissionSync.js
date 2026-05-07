// src/utils/permissionSync.js
const { Op } = require("sequelize");
const { Permission, Role, RolePermission } = require("../models");
const { purgeLegacyPermissions } = require("./purgeLegacyPermissions");
const {
  DEFAULT_LEARNER_ROLE_DESCRIPTION,
  DEFAULT_LEARNER_ROLE_NAME,
} = require("../config/defaultLearnerPermissions");
const {
  ORG_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_DESCRIPTION,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION,
} = require("../config/systemBaselineRoles");
const {
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  BASELINE_NAME_TO_PERMISSIONS,
  ALL_MATRIX_PERMISSION_NAMES,
} = require("../config/permissionMatrixBaselines");

const SUPER_ADMIN_BASELINE_ROLE_DESCRIPTION =
  "Platform Super Admin baseline (docs matrix); JWT for SUPERADMIN still grants full catalog bypass on login.";

/** Old names from prior releases — renamed to shorter labels; same org_id=null row is updated in place. */
const LEGACY_BASELINE_ROLE_RENAMES = {
  "Default Learner": "Learner",
  "Organization Admin (baseline)": "Organization Admin",
  "Branch / Unit Admin (baseline)": "Branch Admin",
  "Department Admin (baseline)": "Department Admin",
};

const BASELINE_ROLE_DESCRIPTION_BY_NAME = Object.freeze({
  [SUPER_ADMIN_BASELINE_ROLE_NAME]: SUPER_ADMIN_BASELINE_ROLE_DESCRIPTION,
  [ORG_ADMIN_BASELINE_ROLE_NAME]: ORG_ADMIN_BASELINE_ROLE_DESCRIPTION,
  [BRANCH_UNIT_BASELINE_ROLE_NAME]: BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION,
  [DEPT_ADMIN_BASELINE_ROLE_NAME]: DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION,
  [DEFAULT_LEARNER_ROLE_NAME]: DEFAULT_LEARNER_ROLE_DESCRIPTION,
});

async function migrateLegacyBaselineRoleNames() {
  for (const [oldName, newName] of Object.entries(LEGACY_BASELINE_ROLE_RENAMES)) {
    if (oldName === newName) continue;
    const oldRole = await Role.findOne({
      where: { name: oldName, org_id: { [Op.is]: null } },
    });
    if (!oldRole) continue;
    const conflict = await Role.findOne({
      where: { name: newName, org_id: { [Op.is]: null } },
    });
    if (conflict && conflict.id !== oldRole.id) {
      console.warn(
        `--- Baseline rename skipped: "${newName}" already exists; remove duplicate "${oldName}" manually if needed ---`
      );
      continue;
    }
    await oldRole.update({ name: newName });
    console.log(`--- Renamed system baseline role "${oldName}" → "${newName}" ---`);
  }
}

/**
 * Upsert Permission rows for the full matrix catalog.
 */
async function syncMatrixPermissionCatalog() {
  for (const name of ALL_MATRIX_PERMISSION_NAMES) {
    await Permission.findOrCreate({
      where: { name },
      defaults: { description: `Practikal permission: ${name}` },
    });
  }
}

/**
 * Replace RolePermissions for a global baseline role (org_id null) from an explicit permission name list.
 */
async function syncExplicitBaselineRole(roleName, description, permissionNames) {
  const [role] = await Role.findOrCreate({
    where: { name: roleName, org_id: { [Op.is]: null } },
    defaults: {
      description: description || `System baseline role: ${roleName}`,
      org_id: null,
    },
  });
  if ((description ?? "").trim() && role.description !== description) {
    await role.update({ description });
  }

  const permissionIds = [];
  for (const name of permissionNames) {
    const [perm] = await Permission.findOrCreate({
      where: { name },
      defaults: { description: `Practikal permission: ${name}` },
    });
    permissionIds.push(perm.id);
  }

  await RolePermission.destroy({ where: { role_id: role.id } });
  if (permissionIds.length > 0) {
    await RolePermission.bulkCreate(
      permissionIds.map((permission_id) => ({
        role_id: role.id,
        permission_id,
      }))
    );
  }

  console.log(`--- System role "${roleName}" synced (${permissionIds.length} permissions) ---`);
}

/**
 * Syncs permissions with the DB: catalog rows + explicit matrix baselines only.
 */
const syncPermissions = async () => {
  try {
    console.log("--- Syncing Permissions (matrix-backed) ---");

    const removed = await purgeLegacyPermissions();
    if (removed > 0) {
      console.log(`Removed ${removed} legacy permission row(s).`);
    }

    await syncMatrixPermissionCatalog();

    await migrateLegacyBaselineRoleNames();

    for (const [roleName, permNames] of Object.entries(BASELINE_NAME_TO_PERMISSIONS)) {
      const description =
        BASELINE_ROLE_DESCRIPTION_BY_NAME[roleName] || `System baseline role: ${roleName}`;
      await syncExplicitBaselineRole(roleName, description, permNames);
    }

    console.log("--- Permissions Sync Completed ---");
  } catch (error) {
    console.error("Error syncing permissions:", error);
  }
};

module.exports = syncPermissions;
