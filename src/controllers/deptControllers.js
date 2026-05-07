const { 
  createDeptService, 
  getOrgsDeptService, 
  getDeptByIdService,
  updateDeptService,
} = require("../services/deptService");

const createDeptController = async (req, res, next) => {
  try {
    const ut = req.user.user_type;
    const org_id =
      ut === "SUPERADMIN" ? req.body.org_id : req.user.org_id;

    if (!org_id) throw new Error("errors.org_id_required");

    // Enforce unit_id scoping for UNIT_ADMIN
    const deptData = { ...req.body, org_id };
    if (ut === "UNIT_ADMIN") {
      if (!req.user.unit_id) throw new Error("Forbidden: Unit Admin must be assigned to a unit.");
      deptData.unit_id = req.user.unit_id;
    } else if (ut === "ORG_ADMIN") {
      // ORG_ADMIN can create org-level departments (unit_id = null) or assign to specific branches.
      // We rely on the request payload.
    }

    const dept = await createDeptService(deptData);
    
    res.status(201).json({
      success: true,
      message: req.t ? req.t("success.dept_created") : "Department created successfully",
      dept,
    });
  } catch (error) {
    next(error);
  }
};

const getOrgsDeptController = async (req, res, next) => {
  try {
    const ut = req.user.user_type;
    const paramOrg = req.params.orgId;
    const queryOrg = req.query.org_id;

    let org_id;
    if (ut === "SUPERADMIN") {
      org_id = paramOrg || queryOrg || null;
      if (!org_id) {
        return res.status(400).json({
          success: false,
          message: "Organization id is required (path /organization/:orgId or ?org_id=)",
        });
      }
    } else {
      org_id = req.user.org_id;
      if (paramOrg && paramOrg !== org_id) {
        return res.status(403).json({ success: false, message: "Forbidden" });
      }
    }

    let unit_id = undefined;
    if (ut === "UNIT_ADMIN") {
      unit_id = req.user.unit_id || null;
    }

    const depts = await getOrgsDeptService(org_id, unit_id);
    res.status(200).json({
      success: true,
      depts,
    });
  } catch (error) {
    next(error);
  }
};

const getDeptByIdController = async (req, res, next) => {
  try {
    const dept = await getDeptByIdService(req.params.id);
    const ut = req.user.user_type;
    if (ut !== "SUPERADMIN" && req.user.org_id !== dept.org_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (ut === "UNIT_ADMIN" && req.user.unit_id !== dept.unit_id) {
      return res.status(403).json({ success: false, message: "Forbidden: Department does not belong to your branch." });
    }
    res.status(200).json({
      success: true,
      dept,
    });
  } catch (error) {
    next(error);
  }
};

const updateDeptController = async (req, res, next) => {
  try {
    const existing = await getDeptByIdService(req.params.id);
    const ut = req.user.user_type;
    if (ut !== "SUPERADMIN" && req.user.org_id !== existing.org_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (ut === "UNIT_ADMIN" && req.user.unit_id !== existing.unit_id) {
      return res.status(403).json({ success: false, message: "Forbidden: Department does not belong to your branch." });
    }
    const dept = await updateDeptService(req.params.id, req.body);
    res.status(200).json({
      success: true,
      message: req.t ? req.t("success.dept_updated") : "Department updated",
      dept,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
  createDeptController,
  getOrgsDeptController,
  getDeptByIdController,
  updateDeptController,
};

