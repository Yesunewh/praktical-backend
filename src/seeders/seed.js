const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "..", "config", ".env") });
const { User } = require("../models");
const { hashPassword } = require("../utils/hashUtils");
const sequelize = require("../config/database");

const seedSuperAdmin = async () => {
  const phone = "0911000000";
  const password = "SuperAdmin123!";

  try {
    // Sync models (optional, but ensures table exists)
    // await sequelize.sync(); 

    const existingAdmin = await User.findOne({ where: { user_type: "SUPERADMIN" } });
    if (existingAdmin) {
      console.log("✅ Super Admin already exists in the system.");
      return;
    }

    const hashedPassword = await hashPassword(password);
    
    await User.create({
      first_name: "Super",
      last_name: "Admin",
      phone_number: phone,
      password: hashedPassword,
      user_type: "SUPERADMIN",
      status: "ACTIVE",
      language_preference: "eng"
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
