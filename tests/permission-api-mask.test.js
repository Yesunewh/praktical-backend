"use strict";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");
const { applySuperAdminPermissionsResponseMask } = require("../src/utils/permissionApiMask");

describe("applySuperAdminPermissionsResponseMask (GET /permissions contract)", () => {
  test("forces has_access true and clears matrix locks for Super Admin response", () => {
    const input = [
      { id: "1", name: "PLAY_CHALLENGES", has_access: false, matrix_locked_for_editor: true },
      { id: "2", name: "MANAGE_USERS", has_access: false, matrix_locked_for_editor: false },
    ];
    const out = applySuperAdminPermissionsResponseMask(input);
    assert.equal(out[0].has_access, true);
    assert.equal(out[0].matrix_locked_for_editor, false);
    assert.equal(out[1].has_access, true);
    assert.equal(out[1].matrix_locked_for_editor, false);
  });

  test("handles empty list", () => {
    assert.deepEqual(applySuperAdminPermissionsResponseMask([]), []);
  });
});
