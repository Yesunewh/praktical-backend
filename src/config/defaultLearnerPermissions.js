/**
 * Permissions issued on login when user_type is STAFF or INTERNAL and the user
 * has no permissions from UserAssignment / Role (empty role binding).
 * Server resolves the global "Learner" baseline row (org_id null) when present;
 * otherwise falls back to DEFAULT_LEARNER_PERMISSION_NAMES.
 * Source of names: permissionMatrixBaselines (Staff / Learner matrix); must stay aligned with permissionSeeder.js.
 */

const { STAFF_LEARNER_BASELINE_PERMISSION_NAMES } = require("./permissionMatrixBaselines");

const DEFAULT_LEARNER_ROLE_NAME = "Learner";

const DEFAULT_LEARNER_ROLE_DESCRIPTION =
  "Baseline learner permissions for Staff/Internal users when no organizational role is assigned (matches JWT defaults on login).";

const DEFAULT_LEARNER_PERMISSION_NAMES = STAFF_LEARNER_BASELINE_PERMISSION_NAMES;

module.exports = {
  DEFAULT_LEARNER_PERMISSION_NAMES,
  DEFAULT_LEARNER_ROLE_NAME,
  DEFAULT_LEARNER_ROLE_DESCRIPTION,
};
