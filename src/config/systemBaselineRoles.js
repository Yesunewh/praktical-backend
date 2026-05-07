/** Must match DEFAULT_LEARNER_ROLE_NAME in defaultLearnerPermissions.js */
const LEARNER_BASELINE_LABEL = "Learner";

/**
 * System baseline rows on /admin/roles (org_id null). Not UserAssignments by default;
 * they document typical permission bundles per admin tier (see permission tiers).
 * Login JWT fallbacks for admins with no assignment resolve permissions from these rows when present.
 */

const ORG_ADMIN_BASELINE_ROLE_NAME = "Organization Admin";
const ORG_ADMIN_BASELINE_ROLE_DESCRIPTION =
  "Organization Admin matrix baseline (explicit permission list; see permissionMatrixBaselines).";

const BRANCH_UNIT_BASELINE_ROLE_NAME = "Branch Admin";
const BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION =
  "Branch / Unit Admin matrix baseline (explicit permission list; excludes MANAGE_EXAMS, tenant-only structure keys).";

const DEPT_ADMIN_BASELINE_ROLE_NAME = "Department Admin";
const DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION =
  "Department Admin (department head) matrix baseline; org-wide tree/structure keys excluded.";

/** Platform baseline (org_id null); optional row for /admin/roles — must match permissionMatrixBaselines.SUPER_ADMIN_BASELINE_ROLE_NAME */
const SUPER_ADMIN_BASELINE_ROLE_NAME = "Super Admin";

/** Stable sort: learner first, then org → unit → dept; platform Super Admin last. Must match frontend `BASELINE_SYSTEM_ROLE_NAMES`. */
const BASELINE_ROLE_DISPLAY_ORDER = Object.freeze([
  LEARNER_BASELINE_LABEL,
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
]);

module.exports = {
  ORG_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_DESCRIPTION,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_DESCRIPTION,
  DEPT_ADMIN_BASELINE_ROLE_NAME,
  DEPT_ADMIN_BASELINE_ROLE_DESCRIPTION,
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  BASELINE_ROLE_DISPLAY_ORDER,
};
