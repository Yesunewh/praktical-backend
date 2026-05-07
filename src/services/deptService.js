const { Department, User } = require("../models");

/**
 * Create a new department within an organization
 */
const createDeptService = async (deptData) => {
  return await Department.create(deptData);
};

/**
 * Get all departments for a specific organization
 */
const getOrgsDeptService = async (org_id, unit_id = undefined) => {
  const whereClause = { org_id };
  if (unit_id !== undefined) {
    whereClause.unit_id = unit_id;
  }
  return await Department.findAll({
    where: whereClause,
    include: [{
      model: User,
      as: "DepartmentStaff",
      attributes: ["user_id", "first_name", "last_name", "user_type", "phone_number", "email", "status"],
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
      attributes: ["user_id", "first_name", "last_name", "user_type", "dept_id", "org_id", "phone_number", "email", "status"],
    }]
  });
  if (!dept) throw new Error("errors.dept_not_found");
  return dept;
};

const updateDeptService = async (id, patch) => {
  const dept = await Department.findByPk(id);
  if (!dept) throw new Error("errors.dept_not_found");
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
