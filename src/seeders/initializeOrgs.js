const { Permission, Organization, PermissionAllocation } = require("../models");
const sequelize = require("../config/database");

const initializeOrgs = async () => {
  try {
    await sequelize.authenticate();
    console.log("Database connected.");

    const permissions = await Permission.findAll();
    const organizations = await Organization.findAll();

    console.log(`Found ${permissions.length} permissions and ${organizations.length} organizations.`);

    for (const org of organizations) {
      console.log(`Processing ${org.name}...`);
      
      for (const perm of permissions) {
        // Check if already allocated
        const existing = await PermissionAllocation.findOne({
          where: {
            permission_id: perm.id,
            allocation_type: 'ORGANIZATION',
            allocation_id: org.id
          }
        });

        if (!existing) {
          await PermissionAllocation.create({
            permission_id: perm.id,
            allocation_type: 'ORGANIZATION',
            allocation_id: org.id,
            effect: 'GRANT'
          });
          console.log(`  - Granted: ${perm.name}`);
        } else {
          console.log(`  - Already exists: ${perm.name}`);
        }
      }
    }

    console.log("Organization permission initialization complete.");
    process.exit(0);
  } catch (error) {
    console.error("Initialization failed:", error);
    process.exit(1);
  }
};

initializeOrgs();
