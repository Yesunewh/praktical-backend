const unitService = require("../services/unitService");

exports.createUnitType = async (req, res) => {
  try {
    let orgId = req.user.org_id;
    if (req.user.user_type === "SUPERADMIN") {
      orgId = req.body.org_id || req.query.org_id || orgId;
    }
    if (!orgId) {
      return res.status(400).json({ success: false, message: "org_id is required" });
    }
    const { org_id: _drop, ...data } = req.body;
    const type = await unitService.createUnitType(orgId, data);
    res.status(201).json({ success: true, data: type });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.updateUnitType = async (req, res) => {
  try {
    let orgId = req.user.org_id;
    if (req.user.user_type === "SUPERADMIN") {
      orgId = req.body.org_id || req.query.org_id || orgId;
    }
    if (!orgId) {
      return res.status(400).json({ success: false, message: "org_id is required" });
    }
    const type = await unitService.updateUnitType(req.params.id, orgId, req.body);
    res.status(200).json({ success: true, data: type });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.getUnitTypes = async (req, res) => {
  try {
    // If SuperAdmin, orgId comes from query, else pulled from token
    const orgId = req.user.user_type === "SUPERADMIN" ? req.query.org_id : req.user.org_id;
    if (!orgId) return res.status(400).json({ success: false, message: "org_id is required" });

    const types = await unitService.getUnitTypes(orgId);
    res.status(200).json({ success: true, data: types });
  } catch (error) {
    res.status(400).json({ success: false, message: error.message });
  }
};

exports.createUnit = async (req, res) => {
  try {
    let orgId = req.user.org_id;
    if (req.user.user_type === "SUPERADMIN") {
      orgId = req.body.org_id || req.query.org_id || orgId;
    }
    if (!orgId) {
      return res.status(400).json({ success: false, message: "org_id is required" });
    }
    const { org_id: _drop, ...raw } = req.body;
    const parent_id =
      raw.parent_id === undefined || raw.parent_id === null || raw.parent_id === ""
        ? null
        : raw.parent_id;
    const data = { ...raw, parent_id };
    await unitService.assertActorMayCreateUnit(req.user, orgId, data);
    const unit = await unitService.createUnit(orgId, data);
    res.status(201).json({ success: true, data: unit });
  } catch (error) {
    const code = error.statusCode || 400;
    res.status(code).json({ success: false, message: error.message });
  }
};

exports.getUnitsTree = async (req, res) => {
  try {
    const orgId = req.user.user_type === "SUPERADMIN" ? req.query.org_id : req.user.org_id;
    if (!orgId) return res.status(400).json({ success: false, message: "org_id is required" });

    let tree = await unitService.getUnitsTree(orgId);
    if (req.user.user_type === "UNIT_ADMIN") {
      if (!req.user.unit_id) {
        return res.status(403).json({
          success: false,
          message: "Your account is not assigned to a branch.",
        });
      }
      tree = unitService.treeScopedToUnit(tree, req.user.unit_id);
    }
    res.status(200).json({ success: true, data: tree });
  } catch (error) {
    const code = error.statusCode || 400;
    res.status(code).json({ success: false, message: error.message });
  }
};

exports.updateUnit = async (req, res) => {
  try {
    let orgId = req.user.org_id;
    if (req.user.user_type === "SUPERADMIN") {
      orgId = req.body.org_id || req.query.org_id || orgId;
    }
    if (!orgId) {
      return res.status(400).json({ success: false, message: "org_id is required" });
    }
    const { id } = req.params;
    await unitService.assertActorMayEditUnit(req.user, id, orgId);
    const unit = await unitService.updateUnit(id, orgId, req.body);
    res.status(200).json({ success: true, data: unit });
  } catch (error) {
    const code = error.statusCode || 400;
    res.status(code).json({ success: false, message: error.message });
  }
};
