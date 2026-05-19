const roleService = require("../services/roleService");

exports.createCustomRole = async (req, res) => {
  try {
    const isSuperAdmin = req.user.isSuperAdmin;
    let orgId = isSuperAdmin ? req.body.org_id : req.user.org_id;
    if (orgId === "") orgId = null;
    const unitId = req.user.unit ? req.user.unit.id : null;
    const { name, description, permissionIds } = req.body;

    const role = await roleService.createCustomRole(orgId, unitId, name, description, permissionIds, {
      isSuperadmin: isSuperAdmin,
      requesterRoleName: req.user.role?.name,
    });
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const isSuperAdmin = req.user.isSuperAdmin;
    const orgId = isSuperAdmin ? req.query.org_id : req.user.org_id;
    const { includeSystem } = req.query; // boolean toggle

    const roles = await roleService.getRoles(orgId, includeSystem !== "false", req.user.role?.name);
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCustomRole = async (req, res) => {
  try {
    const isSuperAdmin = req.user.isSuperAdmin;
    const orgIdForAccess =
      isSuperAdmin ? req.body.org_id ?? req.user.org_id : req.user.org_id;
    const unitId = req.user.unit ? req.user.unit.id : null;
    const { name, description, permissionIds } = req.body;

    const role = await roleService.updateCustomRole(
      req.params.id,
      { name, description, permissionIds },
      orgIdForAccess,
      unitId,
      {
        isSuperadmin: isSuperAdmin,
        requesterRoleName: req.user.role?.name,
      }
    );
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
