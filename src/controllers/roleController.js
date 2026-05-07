const roleService = require("../services/roleService");

exports.createCustomRole = async (req, res) => {
  try {
    let orgId = req.user.user_type === "SUPERADMIN" ? req.body.org_id : req.user.org_id;
    if (orgId === "") orgId = null;
    const unitId = req.user.unit ? req.user.unit.id : null;
    const { name, description, permissionIds } = req.body;

    const role = await roleService.createCustomRole(orgId, unitId, name, description, permissionIds, {
      isSuperadmin: req.user.user_type === "SUPERADMIN",
      requesterUserType: req.user.user_type,
    });
    res.status(201).json({ success: true, data: role });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getRoles = async (req, res) => {
  try {
    const orgId = req.user.user_type === "SUPERADMIN" ? req.query.org_id : req.user.org_id;
    const { includeSystem } = req.query; // boolean toggle

    const roles = await roleService.getRoles(orgId, includeSystem !== "false", req.user.user_type);
    res.status(200).json({ success: true, data: roles });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateCustomRole = async (req, res) => {
  try {
    const orgIdForAccess =
      req.user.user_type === "SUPERADMIN" ? req.body.org_id ?? req.user.org_id : req.user.org_id;
    const unitId = req.user.unit ? req.user.unit.id : null;
    const { name, description, permissionIds } = req.body;

    const role = await roleService.updateCustomRole(
      req.params.id,
      { name, description, permissionIds },
      orgIdForAccess,
      unitId,
      {
        isSuperadmin: req.user.user_type === "SUPERADMIN",
        requesterUserType: req.user.user_type,
      }
    );
    res.status(200).json({ success: true, data: role });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};
