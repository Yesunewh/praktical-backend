/**
 * HTTP response shaping for GET /permissions.
 * Super Admins are not scoped by org allocation for the UI mask — see permissionController.getAvailablePermissions.
 */
function applySuperAdminPermissionsResponseMask(permissions) {
  return (permissions || []).map((p) => ({
    ...p,
    has_access: true,
    matrix_locked_for_editor: false,
  }));
}

module.exports = {
  applySuperAdminPermissionsResponseMask,
};
