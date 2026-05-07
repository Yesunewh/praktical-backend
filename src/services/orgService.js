const { Organization } = require("../models");
const permissionService = require("./permissionService");

/**
 * Create a new organization
 * @param {Object} orgData
 */
const createOrganizationService = async (orgData) => {
  const { name, slug } = orgData;

  // Check if already exists
  const existing = await Organization.findOne({ where: { slug } });
  if (existing) {
    throw new Error("errors.org_slug_exists");
  }

  const org = await Organization.create(orgData);
  // Grant full permission pool so org admins can create roles (PermissionAllocation ORGANIZATION rows).
  // Existing tenants without rows: run `node src/seeders/initializeOrgs.js` or POST .../permissions/organizations/:orgId/bulk
  await permissionService.bulkAllocateToOrg(org.id, "GRANT");
  return org;
};

/**
 * Get all organizations
 */
const getAllOrgsService = async () => {
  return await Organization.findAll({
    attributes: ["id", "name", "slug", "status", "subscription_plan", "createdAt"],
    order: [["createdAt", "DESC"]]
  });
};

/**
 * Get organization by ID
 */
const getOrgByIdService = async (id) => {
  const org = await Organization.findByPk(id);
  if (!org) throw new Error("errors.org_not_found");
  return org;
};

module.exports = {
  createOrganizationService,
  getAllOrgsService,
  getOrgByIdService
};
