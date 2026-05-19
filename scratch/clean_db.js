const sequelize = require("../src/config/database");

async function cleanDatabase() {
  try {
    console.log("--- Starting Database Cleanup ---");
    
    // 1. Get all unique constraints on the Roles table
    const [results] = await sequelize.query(`
      SELECT conname 
      FROM pg_constraint 
      WHERE conrelid = '"Roles"'::regclass 
      AND contype = 'u';
    `);

    console.log(`Found ${results.length} unique constraints on Roles table.`);

    // 2. Drop each one
    for (const row of results) {
      console.log(`Dropping constraint: ${row.conname}`);
      await sequelize.query(`ALTER TABLE "Roles" DROP CONSTRAINT IF EXISTS "${row.conname}" CASCADE;`);
    }

    console.log("--- Cleanup Finished Successfully ---");
    process.exit(0);
  } catch (error) {
    console.error("Cleanup Failed:", error);
    process.exit(1);
  }
}

cleanDatabase();
