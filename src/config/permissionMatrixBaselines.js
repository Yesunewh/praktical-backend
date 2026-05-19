/**
 * Single source for permission NAMES on global baseline roles (docs/PERMISSION_TEMPLATES_MATRIX.md).
 * "Department Head" in the matrix === {@link DEPT_ADMIN_BASELINE_ROLE_NAME} in code ("Department Admin").
 */

const {
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
} = require("./systemBaselineRoles");

/** Must match DEFAULT_LEARNER_ROLE_NAME in defaultLearnerPermissions.js */
const LEARNER_BASELINE_ROLE_NAME = "Learner";

/**
 * Locked-on learner-style permissions for admin tiers (assigners still get these via baselines/JWT fallback).
 */
const PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS = Object.freeze(["PLAY_CHALLENGES", "VIEW_REMEDIATION"]);

/** Super Admin (platform) matrix block — excludes tenant-only structure roles */
const SUPER_ADMIN_BASELINE_PERMISSION_NAMES = Object.freeze([
  "MANAGE_TENANTS",
  "MANAGE_SYSTEM",
  "MANAGE_USERS",
  "IMPORT_USERS",
  "VIEW_REPORTS",
  "MANAGE_EXAMS",
  "MANAGE_CAMPAIGNS",
  "MANAGE_CHALLENGES",
  "VIEW_DASHBOARD",
  "VIEW_CHALLENGES",
  "PLAY_CHALLENGES",
  "VIEW_REMEDIATION",
  "VIEW_LEADERBOARD",
  "VIEW_ACHIEVEMENTS",
  "VIEW_SUPPORT",
]);

/** Organization Admin defaults (no system tenant provisioning on org row) */
const ORG_ADMIN_BASELINE_PERMISSION_NAMES = Object.freeze([
  "MANAGE_USERS",
  "IMPORT_USERS",
  "MANAGE_DEPARTMENTS",
  "VIEW_REPORTS",
  "MANAGE_EXAMS",
  "MANAGE_CAMPAIGNS",
  "MANAGE_CHALLENGES",
  "MANAGE_TERMINOLOGY",
  "MANAGE_HIERARCHY",
  "MANAGE_ROLES",
  "MANAGE_PERMISSIONS",
  "VIEW_DASHBOARD",
  "VIEW_CHALLENGES",
  "PLAY_CHALLENGES",
  "VIEW_REMEDIATION",
  "VIEW_LEADERBOARD",
  "VIEW_ACHIEVEMENTS",
  "VIEW_SUPPORT",
]);

/** Department Head / DEPT_ADMIN matrix */
const DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES = Object.freeze([
  "MANAGE_USERS",
  "IMPORT_USERS",
  "VIEW_REPORTS",
  "MANAGE_EXAMS",
  "MANAGE_CAMPAIGNS",
  "MANAGE_CHALLENGES",
  "VIEW_DASHBOARD",
  "VIEW_CHALLENGES",
  "PLAY_CHALLENGES",
  "VIEW_REMEDIATION",
  "VIEW_LEADERBOARD",
  "VIEW_ACHIEVEMENTS",
  "VIEW_SUPPORT",
]);

/** Branch / UNIT_ADMIN matrix */
const BRANCH_ADMIN_BASELINE_PERMISSION_NAMES = Object.freeze([
  "MANAGE_USERS",
  "IMPORT_USERS",
  "MANAGE_DEPARTMENTS",
  "VIEW_REPORTS",
  "MANAGE_CAMPAIGNS",
  "MANAGE_CHALLENGES",
  "MANAGE_HIERARCHY",
  "VIEW_DASHBOARD",
  "VIEW_CHALLENGES",
  "PLAY_CHALLENGES",
  "VIEW_REMEDIATION",
  "VIEW_LEADERBOARD",
  "VIEW_ACHIEVEMENTS",
  "VIEW_SUPPORT",
]);

/** Staff / Learner — tunable learner surface */
const STAFF_LEARNER_BASELINE_PERMISSION_NAMES = Object.freeze([
  "VIEW_DASHBOARD",
  "VIEW_CHALLENGES",
  "PLAY_CHALLENGES",
  "VIEW_REMEDIATION",
  "VIEW_LEADERBOARD",
  "VIEW_ACHIEVEMENTS",
  "VIEW_SUPPORT",
]);

const BASELINE_NAME_TO_PERMISSIONS = Object.freeze({
  [SUPER_ADMIN_BASELINE_ROLE_NAME]: SUPER_ADMIN_BASELINE_PERMISSION_NAMES,
  [ORG_ADMIN_BASELINE_ROLE_NAME]: ORG_ADMIN_BASELINE_PERMISSION_NAMES,
  [BRANCH_UNIT_BASELINE_ROLE_NAME]: BRANCH_ADMIN_BASELINE_PERMISSION_NAMES,
  [DEPT_ADMIN_BASELINE_ROLE_NAME]: DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES,
  [LEARNER_BASELINE_ROLE_NAME]: STAFF_LEARNER_BASELINE_PERMISSION_NAMES,
});

/** Union of every permission name used in matrices + seed parity (for Permission row upsert). */
const ALL_MATRIX_PERMISSION_NAMES = Object.freeze(
  Array.from(
    new Set([
      ...SUPER_ADMIN_BASELINE_PERMISSION_NAMES,
      ...ORG_ADMIN_BASELINE_PERMISSION_NAMES,
      "MANAGE_TERMINOLOGY",
      "MANAGE_TENANTS",
      "MANAGE_SYSTEM",
      ...DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES,
      ...BRANCH_ADMIN_BASELINE_PERMISSION_NAMES,
      ...STAFF_LEARNER_BASELINE_PERMISSION_NAMES,
    ])
  ).sort((a, b) => String(a).localeCompare(String(b)))
);

/** Tenant editors mapping to matrix admin columns ORG/Branch/Dept — learner preview perms locked in Role Management. */
function shouldMatrixLockLearnerPreviewForEditor(roleName) {
  return [
    ORG_ADMIN_BASELINE_ROLE_NAME,
    BRANCH_UNIT_BASELINE_ROLE_NAME,
    DEPT_ADMIN_BASELINE_ROLE_NAME,
  ].includes(String(roleName || ""));
}

/**
 * Adds `matrix_locked_for_editor` to GET /permissions rows (Phase 2).
 * @param {Array<Record<string, unknown>>} rows Permission rows already filtered by allocations / tiers.
 * @param {string|null|undefined} roleName
 */
function applyMatrixLockedForEditorMetadata(rows, roleName) {
  const tierLocks = shouldMatrixLockLearnerPreviewForEditor(roleName);
  return rows.map((p) => ({
    ...p,
    matrix_locked_for_editor:
      !!(p.name && PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS.includes(p.name) && tierLocks),
  }));
}

module.exports = {
  LEARNER_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_PERMISSION_NAMES,
  ORG_ADMIN_BASELINE_PERMISSION_NAMES,
  DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES,
  BRANCH_ADMIN_BASELINE_PERMISSION_NAMES,
  STAFF_LEARNER_BASELINE_PERMISSION_NAMES,
  BASELINE_NAME_TO_PERMISSIONS,
  ALL_MATRIX_PERMISSION_NAMES,
  PLAY_PREVIEW_LOCKED_FOR_ADMIN_TIERS,
  shouldMatrixLockLearnerPreviewForEditor,
  applyMatrixLockedForEditorMetadata,
};
