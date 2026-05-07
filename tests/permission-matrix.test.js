"use strict";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const {
  ALL_MATRIX_PERMISSION_NAMES,
  SUPER_ADMIN_BASELINE_PERMISSION_NAMES,
  ORG_ADMIN_BASELINE_PERMISSION_NAMES,
  BRANCH_ADMIN_BASELINE_PERMISSION_NAMES,
  DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES,
  STAFF_LEARNER_BASELINE_PERMISSION_NAMES,
} = require("../src/config/permissionMatrixBaselines");

const {
  SUPERADMIN_ONLY,
  UNIT_ADMIN_HIDDEN,
  DEPT_ADMIN_HIDDEN,
  hiddenPermissionNamesForUserType,
} = require("../src/config/permissionTiers");

describe("permissionMatrixBaselines", () => {
  test("catalog has stable size (seed parity)", () => {
    assert.equal(ALL_MATRIX_PERMISSION_NAMES.length, 20);
  });

  test("Super Admin baseline matches matrix count", () => {
    assert.equal(SUPER_ADMIN_BASELINE_PERMISSION_NAMES.length, 15);
  });

  test("Org Admin baseline count", () => {
    assert.equal(ORG_ADMIN_BASELINE_PERMISSION_NAMES.length, 18);
  });

  test("Branch Admin baseline count", () => {
    assert.equal(BRANCH_ADMIN_BASELINE_PERMISSION_NAMES.length, 14);
  });

  test("Dept Head baseline count", () => {
    assert.equal(DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES.length, 13);
  });

  test("Staff baseline count", () => {
    assert.equal(STAFF_LEARNER_BASELINE_PERMISSION_NAMES.length, 7);
  });

  test("MANAGE_DEPARTMENTS and IMPORT_USERS granted to Branch baseline", () => {
    assert.ok(BRANCH_ADMIN_BASELINE_PERMISSION_NAMES.includes("MANAGE_DEPARTMENTS"));
    assert.ok(BRANCH_ADMIN_BASELINE_PERMISSION_NAMES.includes("IMPORT_USERS"));
  });

  test("Dept Head keeps IMPORT_USERS; omits tenant structure roles", () => {
    assert.ok(DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES.includes("IMPORT_USERS"));
    assert.ok(!DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES.includes("MANAGE_DEPARTMENTS"));
    assert.ok(!DEPARTMENT_HEAD_BASELINE_PERMISSION_NAMES.includes("MANAGE_HIERARCHY"));
  });

  test("MANAGE_EXAMS omitted from Branch baseline", () => {
    assert.ok(!BRANCH_ADMIN_BASELINE_PERMISSION_NAMES.includes("MANAGE_EXAMS"));
  });
});

describe("permissionTiers (matrix assigners)", () => {
  test("ORG_ADMIN hides only platform system perms", () => {
    const h = hiddenPermissionNamesForUserType("ORG_ADMIN");
    assert.deepEqual(h, SUPERADMIN_ONLY);
  });

  test("UNIT_ADMIN may assign IMPORT_USERS and MANAGE_DEPARTMENTS per matrix", () => {
    const h = hiddenPermissionNamesForUserType("UNIT_ADMIN");
    assert.ok(!h.has("IMPORT_USERS"));
    assert.ok(!h.has("MANAGE_DEPARTMENTS"));
    assert.ok(h.has("MANAGE_EXAMS"));
    assert.ok(UNIT_ADMIN_HIDDEN.has("MANAGE_EXAMS"));
    assert.ok(h.has("MANAGE_ROLES"));
  });

  test("DEPT_ADMIN may assign IMPORT_USERS; not MANAGE_DEPARTMENTS/HIERARCHY", () => {
    const h = hiddenPermissionNamesForUserType("DEPT_ADMIN");
    assert.ok(!h.has("IMPORT_USERS"));
    assert.ok(h.has("MANAGE_DEPARTMENTS"));
    assert.ok(h.has("MANAGE_HIERARCHY"));
    assert.ok(DEPT_ADMIN_HIDDEN.has("MANAGE_DEPARTMENTS"));
  });

  test("SUPERADMIN has no tier mask", () => {
    assert.equal(hiddenPermissionNamesForUserType("SUPERADMIN").size, 0);
  });
});
