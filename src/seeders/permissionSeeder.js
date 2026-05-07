const { Permission } = require("../models");
const sequelize = require("../config/database");
const { purgeLegacyPermissions } = require("../utils/purgeLegacyPermissions");

// Practikal permissions only. Legacy names (ADMIN_PERMISSIONS, MANAGE_MINING, MANAGE_FOREST,
// MANAGE_POLLUTION, MANAGE_PAYMENTS) are not seeded — they are purged at the start of this script
// if they still exist (see ../config/legacyPermissionsRemove.js).

const permissions = [
  // --- Learner Module ---
  { name: 'VIEW_DASHBOARD', description: 'Access to the main learning dashboard' },
  { name: 'VIEW_CHALLENGES', description: 'Browse available challenges and paths' },
  { name: 'PLAY_CHALLENGES', description: 'Permission to solve and submit challenges' },
  { name: 'VIEW_REMEDIATION', description: 'Access to the mistake review and remediation area' },
  { name: 'VIEW_LEADERBOARD', description: 'View the organization and global leaderboards' },
  { name: 'VIEW_ACHIEVEMENTS', description: 'View personal and unlocked achievements' },
  { name: 'VIEW_SUPPORT', description: 'Access the support and help desk' },

  // --- Personnel & Intelligence Module ---
  { name: 'MANAGE_USERS', description: 'View, create, edit and deactivate user accounts' },
  { name: 'MANAGE_DEPARTMENTS', description: 'Create departments, assign heads, and manage department staff within the organization' },
  { name: 'IMPORT_USERS', description: 'Bulk onboard employees via Excel' },
  { name: 'VIEW_REPORTS', description: 'Access to the detailed progress and engagement reports' },

  // --- Content & Training Module ---
  { name: 'MANAGE_EXAMS', description: 'Create and manage the centralized Exam Bank' },
  { name: 'MANAGE_CAMPAIGNS', description: 'Schedule and assign training campaigns to units' },
  { name: 'MANAGE_CHALLENGES', description: 'Build and configure interactive challenges' },

  // --- Structure & Rule Module ---
  { name: 'MANAGE_TERMINOLOGY', description: 'Configure custom naming for the hierarchy levels' },
  { name: 'MANAGE_HIERARCHY', description: 'Build and modify the structural branch tree' },
  { name: 'MANAGE_ROLES', description: 'Create and configure organizational roles' },
  { name: 'MANAGE_PERMISSIONS', description: 'Allocate and manage permission matrices' },

  // --- System Module (SuperAdmin) ---
  { name: 'MANAGE_TENANTS', description: 'Provision and manage separate organization tenants' },
  { name: 'MANAGE_SYSTEM', description: 'Configure global platform parameters and white-labeling' }
];

const seedPermissions = async () => {
  try {
    console.log("💾 Starting Permission Seeder...");
    console.log("-----------------------------------------");

    const purged = await purgeLegacyPermissions();
    if (purged > 0) {
      console.log(`🗑 Removed ${purged} legacy permission row(s) (ADMIN_PERMISSIONS, MANAGE_MINING, …).`);
    }

    for (const perm of permissions) {
      const [record, created] = await Permission.findOrCreate({
        where: { name: perm.name },
        defaults: perm
      });

      if (created) {
        console.log(`✅ CREATED: ${perm.name}`);
      } else {
        console.log(`ℹ️ EXISTS:  ${perm.name}`);
      }
    }

    console.log("-----------------------------------------");
    console.log("🚀 Permission Seeding COMPLETE!");
  } catch (error) {
    console.error("❌ Seeding FAILED:", error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

seedPermissions();
