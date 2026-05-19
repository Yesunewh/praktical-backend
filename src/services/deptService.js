const { Department, User } = require("../models");

/**
 * Create a new department within an organization
 */
const createDeptService = async (deptData) => {
  const existing = await Department.findOne({
    where: {
      name: deptData.name,
      org_id: deptData.org_id,
      unit_id: deptData.unit_id || null,
    }
  });

  if (existing) {
    const context = deptData.unit_id ? "branch" : "organization";
    const err = new Error(`A department with the name '${deptData.name}' already exists in this ${context}.`);
    err.statusCode = 400;
    throw err;
  }

  return await Department.create(deptData);
};

/**
 * Get all departments for a specific organization.
 * unit_ids: optional array of unit IDs to filter by (OR logic), or a single unit_id string.
 */
const getOrgsDeptService = async (org_id, unit_ids = undefined) => {
  const whereClause = { org_id };
  if (unit_ids !== undefined) {
    const { Op } = require("sequelize");
    if (Array.isArray(unit_ids)) {
      whereClause.unit_id = { [Op.in]: unit_ids };
    } else {
      whereClause.unit_id = unit_ids;
    }
  }
  return await Department.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: "DepartmentStaff",
      attributes: ["user_id", "first_name", "last_name", "phone_number", "email", "status"],
    }],
    order: [["name", "ASC"]]
  });
};

/**
 * Get department by ID
 */
const getDeptByIdService = async (id) => {
  const dept = await Department.findByPk(id, {
    include: [{
      model: User,
      as: "DepartmentStaff",
      attributes: ["user_id", "first_name", "last_name", "dept_id", "org_id", "phone_number", "email", "status"],
    }]
  });
  if (!dept) throw new Error("errors.dept_not_found");
  return dept;
};

const updateDeptService = async (id, patch) => {
  const dept = await Department.findByPk(id);
  if (!dept) throw new Error("errors.dept_not_found");

  if (patch.name !== undefined || patch.unit_id !== undefined) {
    const checkName = patch.name !== undefined ? patch.name : dept.name;
    const checkUnitId = patch.unit_id !== undefined ? patch.unit_id : dept.unit_id;

    const existing = await Department.findOne({
      where: {
        name: checkName,
        org_id: dept.org_id,
        unit_id: checkUnitId || null,
      }
    });

    if (existing && existing.id !== id) {
      const context = checkUnitId ? "branch" : "organization";
      const err = new Error(`A department with the name '${checkName}' already exists in this ${context}.`);
      err.statusCode = 400;
      throw err;
    }
  }

  const allowed = ["name", "description", "status", "unit_id"];
  for (const key of allowed) {
    if (patch[key] !== undefined) dept[key] = patch[key];
  }
  await dept.save();
  return dept;
};

module.exports = {
  createDeptService,
  getOrgsDeptService,
  getDeptByIdService,
  updateDeptService,
};
