const { Organization, User, Department, Role, UserAssignment } = require("../models");
const permissionService = require("./permissionService");
const roleService = require("./roleService");

const sequelize = require("../config/database");

/**
 * Create a new organization (Atomic Transaction)
 * @param {Object} orgData
 */
const createOrganizationService = async (orgData) => {
  const transaction = await sequelize.transaction();
  try {
    // 1. Create Organization
    const org = await Organization.create(orgData, { transaction });

    // 2. Grant permissions
    await permissionService.bulkAllocateToOrg(org.id, "GRANT", { transaction });
    
    // 3. Seed default roles (Org Admin, Dept Admin, Branch Admin, Learner)
    await roleService.seedOrganizationRoles(org.id, transaction);
    
    await transaction.commit();
    return org;
  } catch (error) {
    await transaction.rollback();
    console.error("Organization Creation Failed:", error);
    throw error;
  }
};

/**
 * Get all organizations
 */
const getAllOrgsService = async () => {
  return await Organization.findAll({
    attributes: ["id", "name", "status", "subscription_plan", "logo_url", "createdAt"],
    order: [["createdAt", "DESC"]]
  });
};

/**
 * Get organization by ID with Users and Departments
 */
const getOrgByIdService = async (id) => {
  const org = await Organization.findByPk(id, {
    include: [
      {
        model: User,
        as: "Staff",
        required: false,
        where: {
          dept_id: null,
          unit_id: null
        },
        attributes: ["user_id", "first_name", "last_name", "phone_number", "status"],
        include: [{
          model: UserAssignment,
          required: false,
          include: [{ model: Role, attributes: ["name"], required: false }]
        }]
      },
      {
        model: Department,
        as: "Departments",
        attributes: ["id", "name"],
      }
    ]
  });
  
  if (!org) throw new Error("errors.org_not_found");
  return org;
};

module.exports = {
  createOrganizationService,
  getAllOrgsService,
  getOrgByIdService
};
