const sequelize = require("./database"); // Path to your sequelize instance


// Check if the connection to the database is successful
sequelize
  .authenticate()
  .then(() => {
    console.log("Connection has been established successfully.");
        console.log(process.env.DB_USER, process.env.DB_PASSWORD, process.env.DB_HOST, process.env.DB_PORT, process.env.DB_NAME);
  })
  .catch((error) => {
    console.error("Unable to connect to the database:", error);
  });
