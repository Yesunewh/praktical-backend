const permissionService = require("../services/permissionService");
const { applySuperAdminPermissionsResponseMask } = require("../utils/permissionApiMask");

exports.pushPermission = async (req, res) => {
  try {
    const permission = await permissionService.pushPermission(req.body);
    res.status(201).json({ success: true, data: permission });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.allocatePermission = async (req, res) => {
  try {
    const { permissionId } = req.params;
    const type = req.body.type ?? req.body.target_type;
    let targetId = req.body.targetId ?? req.body.target_id;
    if (targetId === "" || targetId === undefined) targetId = null;
    const { effect } = req.body;
    const allocation = await permissionService.allocatePermission(permissionId, type, targetId, effect, req.user);
    res.status(201).json({ success: true, data: allocation });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.bulkAllocate = async (req, res) => {
  try {
    const { orgId } = req.params;
    const { effect } = req.body;
    const result = await permissionService.bulkAllocateToOrg(orgId, effect);
    res.status(200).json({ success: true, data: result });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getAvailablePermissions = async (req, res) => {
  try {
    const isSuperAdmin = req.user.isSuperAdmin;
    const orgId = isSuperAdmin ? req.query.org_id : req.user.org_id;
    const unitId = req.user.unit ? req.user.unit.id : null;

    let permissions = await permissionService.getAvailablePermissions(orgId, unitId, req.user.role?.name);
    // SuperAdmins are not scoped by org allocations for this mask — otherwise every
    // permission stays "locked" when no SYSTEM grants exist yet (common on fresh DB).
    if (isSuperAdmin) {
      permissions = applySuperAdminPermissionsResponseMask(permissions);
    }
    res.status(200).json({ success: true, data: permissions });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
