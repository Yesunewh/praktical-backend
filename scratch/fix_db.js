const { Sequelize } = require("sequelize");
require("dotenv").config();

const sequelize = new Sequelize(
  `postgres://${process.env.DB_USER}:${process.env.DB_PASSWORD}@${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_NAME}`,
  {
    dialect: "postgres",
    logging: console.log,
  }
);

async function run() {
  try {
    console.log("Altering UserAssignments table to allow null unit_id...");
    await sequelize.query('ALTER TABLE "UserAssignments" ALTER COLUMN "unit_id" DROP NOT NULL;');
    console.log("Success!");
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    process.exit(1);
  }
}

run();
