const { 
  createDeptService, 
  getOrgsDeptService, 
  getDeptByIdService,
  updateDeptService,
} = require("../services/deptService");
const { OrganizationalUnit } = require("../models");
const {
  SUPER_ADMIN_BASELINE_ROLE_NAME,
  ORG_ADMIN_BASELINE_ROLE_NAME,
  BRANCH_UNIT_BASELINE_ROLE_NAME,
} = require("../config/systemBaselineRoles");

const createDeptController = async (req, res, next) => {
  try {
    const actorRoleName = req.user.role?.name;
    const isSuperAdmin = req.user.isSuperAdmin;
    const org_id = isSuperAdmin ? req.body.org_id : req.user.org_id;

    if (!org_id) throw new Error("errors.org_id_required");

    if (req.body.unit_id === "") {
      req.body.unit_id = null;
    }

    const deptData = { ...req.body, org_id };

    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      if (!req.user.unit_id) throw new Error("Forbidden: You must be assigned to a branch.");

      if (req.body.unit_id === undefined || req.body.unit_id === null || req.body.unit_id === "") {
        const err = new Error("Forbidden: Branch administrators must assign departments strictly to their own branch. Organization-wide departments are not allowed.");
        err.statusCode = 403;
        throw err;
      }

      if (String(req.body.unit_id) !== String(req.user.unit_id)) {
        const err = new Error("Forbidden: You may only create departments within your own branch.");
        err.statusCode = 403;
        throw err;
      }

      deptData.unit_id = req.user.unit_id;
    } else if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      if (req.body.unit_id !== undefined && req.body.unit_id !== null && req.body.unit_id !== "") {
        const err = new Error("Forbidden: Organization administrators can only create organization-wide departments.");
        err.statusCode = 403;
        throw err;
      }
      deptData.unit_id = null;
    }

    if (req.body.unit_id) {
      const unit = await OrganizationalUnit.findOne({
        where: {
          id: req.body.unit_id,
          org_id,
        }
      });
      if (!unit) {
        const err = new Error("Invalid organizational unit: Unit does not exist or does not belong to this organization.");
        err.statusCode = 400;
        throw err;
      }
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
    const actorRoleName = req.user.role?.name;
    const isSuperAdmin = req.user.isSuperAdmin;
    const paramOrg = req.params.orgId;
    const queryOrg = req.query.org_id;

    let org_id;
    if (isSuperAdmin) {
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

    let unit_ids = undefined;
    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME && req.user.unit_id) {
      // Only own branch
      unit_ids = req.user.unit_id;
    }

    const depts = await getOrgsDeptService(org_id, unit_ids);
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
    const actorRoleName = req.user.role?.name;
    const isSuperAdmin = req.user.isSuperAdmin;
    if (!isSuperAdmin && req.user.org_id !== dept.org_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }
    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      if (String(dept.unit_id) !== String(req.user.unit_id)) {
        return res.status(403).json({ success: false, message: "Forbidden: Department does not belong to your branch." });
      }
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
    const actorRoleName = req.user.role?.name;
    const isSuperAdmin = req.user.isSuperAdmin;

    if (!isSuperAdmin && req.user.org_id !== existing.org_id) {
      return res.status(403).json({ success: false, message: "Forbidden" });
    }

    if (actorRoleName === BRANCH_UNIT_BASELINE_ROLE_NAME) {
      if (String(existing.unit_id) !== String(req.user.unit_id)) {
        return res.status(403).json({ success: false, message: "Forbidden: Department does not belong to your branch." });
      }
      if (req.body.unit_id !== undefined) {
        if (req.body.unit_id === null || req.body.unit_id === "") {
          return res.status(403).json({ success: false, message: "Forbidden: You may not move your department to organization level." });
        }
        if (String(req.body.unit_id) !== String(req.user.unit_id)) {
          return res.status(403).json({ success: false, message: "Forbidden: You may not move departments outside your own branch." });
        }
      }
    } else if (actorRoleName === ORG_ADMIN_BASELINE_ROLE_NAME) {
      if (existing.unit_id !== null) {
        return res.status(403).json({ success: false, message: "Forbidden: You may only modify organization-wide departments." });
      }
      if (req.body.unit_id !== undefined && req.body.unit_id !== null && req.body.unit_id !== "") {
        return res.status(403).json({ success: false, message: "Forbidden: Organization administrators cannot move departments to a branch unit." });
      }
    }

    if (req.body.unit_id === "") {
      req.body.unit_id = null;
    }

    if (req.body.unit_id) {
      const org_id = existing.org_id;
      const unit = await OrganizationalUnit.findOne({
        where: {
          id: req.body.unit_id,
          org_id,
        }
      });
      if (!unit) {
        const err = new Error("Invalid organizational unit: Unit does not exist or does not belong to this organization.");
        err.statusCode = 400;
        throw err;
      }
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

