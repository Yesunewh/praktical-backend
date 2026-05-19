const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
const { User, Role, UserAssignment } = require("../models");
const { hashPassword } = require("../utils/hashUtils");
const sequelize = require("../config/database");
const syncPermissions = require("../utils/permissionSync");
const { SUPER_ADMIN_BASELINE_ROLE_NAME } = require("../config/systemBaselineRoles");

const seedSuperAdmin = async () => {
  const phone = "0911000000";
  const password = "SuperAdmin123!";

  try {
    console.log("💾 Starting Super Admin Seeder...");
    
    // Ensure permissions and baseline roles exist
    await syncPermissions();

    const role = await Role.findOne({ where: { name: SUPER_ADMIN_BASELINE_ROLE_NAME, org_id: null } });
    if (!role) {
      throw new Error(`Critical: ${SUPER_ADMIN_BASELINE_ROLE_NAME} role not found after sync.`);
    }

    // Check for existing super admin via assignment or phone
    const existingAdmin = await User.findOne({ 
      where: { phone_number: phone },
      include: [{ model: UserAssignment, include: [{ model: Role, where: { name: SUPER_ADMIN_BASELINE_ROLE_NAME } }] }]
    });

    if (existingAdmin) {
      console.log("✅ Super Admin already exists in the system.");
      return;
    }

    const hashedPassword = await hashPassword(password);
    
    const user = await User.create({
      first_name: "Super",
      last_name: "Admin",
      phone_number: phone,
      password: hashedPassword,
      status: "ACTIVE",
      language_preference: "eng"
    });

    await UserAssignment.create({
      user_id: user.user_id,
      role_id: role.id,
      unit_id: null
    });

    console.log("🚀 Super Admin Account Created SUCCESSFULLY!");
    console.log("-----------------------------------------");
    console.log(`Phone Number: ${phone}`);
    console.log(`Password:     ${password}`);
    console.log("-----------------------------------------");
  } catch (error) {
    console.error("❌ Failed to seed Super Admin:", error.message);
  } finally {
    await sequelize.close();
    process.exit();
  }
};

seedSuperAdmin();
