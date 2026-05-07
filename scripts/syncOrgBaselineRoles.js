#!/usr/bin/env node
"use strict";

/**
 * Compare (and optionally rewrite) org-owned roles whose **name** matches a matrix baseline
 * (see `BASELINE_NAME_TO_PERMISSIONS` in `src/config/permissionMatrixBaselines.js`) so their
 * `RolePermissions` match the current code matrix.
 *
 * Destructive when used with `--apply`: **replaces** all `RolePermissions` for each matched row.
 * Global baselines (`org_id` null) are **never** touched (use app boot `permissionSync`).
 *
 * Usage:
 *   node scripts/syncOrgBaselineRoles.js                 # dry-run, all orgs
 *   node scripts/syncOrgBaselineRoles.js --org=<uuid>    # one tenant
 *   node scripts/syncOrgBaselineRoles.js --apply --org=<uuid>
 *
 * Prerequisites: DB env (see `src/config/.env`). Ensure `Permissions` rows exist (`npm run seed` / app sync).
 *
 * Safety: back up the database. Review dry-run output before `--apply`. Prefer org-by-org apply.
 */

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../src/config/.env") });

const { Op } = require("sequelize");
const sequelize = require("../src/config/database");
const { Role, Permission, RolePermission } = require("../src/models");
const { BASELINE_NAME_TO_PERMISSIONS } = require("../src/config/permissionMatrixBaselines");
const { SUPER_ADMIN_BASELINE_ROLE_NAME } = require("../src/config/systemBaselineRoles");

function parseArgs() {
  const out = { org: null, apply: false };
  for (const a of process.argv.slice(2)) {
    if (a === "--apply") out.apply = true;
    else if (a.startsWith("--org=")) out.org = a.slice(6).trim();
  }
  return out;
}

async function permissionIdsForNames(orderedNames) {
  const ids = [];
  for (const name of orderedNames) {
    const p = await Permission.findOne({
      where: { name },
      attributes: ["id"],
      raw: true,
    });
    if (!p) {
      throw new Error(
        `Missing Permission "${name}" — run application permission sync / seed first.`
      );
    }
    ids.push(p.id);
  }
  return ids;
}

async function main() {
  const { org, apply } = parseArgs();
  const baselineRoleNames = new Set(Object.keys(BASELINE_NAME_TO_PERMISSIONS));
  baselineRoleNames.delete(SUPER_ADMIN_BASELINE_ROLE_NAME);

  const where = org ? { org_id: org } : { org_id: { [Op.ne]: null } };

  const roles = await Role.findAll({ where, order: [["org_id", "ASC"], ["name", "ASC"]] });
  let applyCount = 0;

  for (const role of roles) {
    if (!baselineRoleNames.has(role.name)) continue;

    const expectedNames = BASELINE_NAME_TO_PERMISSIONS[role.name];
    if (!expectedNames) continue;

    const links = await RolePermission.findAll({
      where: { role_id: role.id },
      include: [{ model: Permission, attributes: ["name"], required: true }],
    });
    const currentNames = new Set(links.map((l) => l.Permission && l.Permission.name).filter(Boolean));
    const expectedSet = new Set(expectedNames);

    const missing = [...expectedSet].filter((n) => !currentNames.has(n));
    const extra = [...currentNames].filter((n) => !expectedSet.has(n));

    if (missing.length === 0 && extra.length === 0) {
      console.log(`OK   org=${role.org_id}\trole="${role.name}"\tid=${role.id}`);
      continue;
    }

    console.log(
      `DIFF org=${role.org_id}\trole="${role.name}"\tid=${role.id}\tmissing=[${missing.join(
        ", "
      )}]\textra=[${extra.join(", ")}]`
    );

    if (apply) {
      const permIds = await permissionIdsForNames([...expectedNames]);
      await sequelize.transaction(async (t) => {
        await RolePermission.destroy({ where: { role_id: role.id }, transaction: t });
        if (permIds.length > 0) {
          await RolePermission.bulkCreate(
            permIds.map((permission_id) => ({
              role_id: role.id,
              permission_id,
            })),
            { transaction: t }
          );
        }
      });
      console.log(`     APPLIED\t${permIds.length} permission(s)`);
      applyCount += 1;
    }
  }

  if (apply) {
    console.log(`--- Finished. Roles rewritten: ${applyCount} ---`);
  } else {
    console.log("--- Dry run only (no writes). Pass --apply after review. ---");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => sequelize.close());
