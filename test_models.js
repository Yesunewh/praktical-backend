require("dotenv").config({ path: "./src/config/.env" });
const sequelize = require("./src/config/database");
const models = require("./src/models");

async function testSync() {
  try {
    console.log("Testing model constraints and relationships...");
    
    // We only authenticate to make sure the app loads Models successfully without crashing.
    // If it throws an error in relationships, it will throw here.
    await sequelize.authenticate();
    console.log("Sequelize connection and model parsing successful!");
    process.exit(0);
  } catch (err) {
    console.error("Error with models:", err);
    process.exit(1);
  }
}

testSync();
