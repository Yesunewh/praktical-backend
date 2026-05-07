"use strict";

const assert = require("node:assert/strict");
const { test, describe } = require("node:test");

const {
  applyMatrixLockedForEditorMetadata,
  shouldMatrixLockLearnerPreviewForEditor,
} = require("../src/config/permissionMatrixBaselines");

describe("applyMatrixLockedForEditorMetadata (Phase 2 API shape)", () => {
  const stubRows = [
    { id: "a", name: "PLAY_CHALLENGES", has_access: true },
    { id: "b", name: "VIEW_REMEDIATION", has_access: true },
    { id: "c", name: "MANAGE_USERS", has_access: true },
  ];

  test("ORG_ADMIN gets matrix_locked on preview perms only", () => {
    const out = applyMatrixLockedForEditorMetadata(stubRows, "ORG_ADMIN");
    const play = out.find((r) => r.name === "PLAY_CHALLENGES");
    const rem = out.find((r) => r.name === "VIEW_REMEDIATION");
    const mu = out.find((r) => r.name === "MANAGE_USERS");
    assert.equal(play.matrix_locked_for_editor, true);
    assert.equal(rem.matrix_locked_for_editor, true);
    assert.equal(mu.matrix_locked_for_editor, false);
  });

  test("SUPERADMIN tier does not lock in metadata (controller also clears)", () => {
    const out = applyMatrixLockedForEditorMetadata(stubRows, "SUPERADMIN");
    assert.ok(out.every((r) => !r.matrix_locked_for_editor));
    assert.equal(shouldMatrixLockLearnerPreviewForEditor("SUPERADMIN"), false);
  });

  test("STAFF does not lock", () => {
    const out = applyMatrixLockedForEditorMetadata(stubRows, "STAFF");
    assert.ok(out.every((r) => !r.matrix_locked_for_editor));
  });
});
