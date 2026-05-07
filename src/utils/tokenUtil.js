const jwt = require("jsonwebtoken");
require("dotenv").config({ path: "../config/.env" });

const generateToken = (payload) => {

  return jwt.sign({ payload }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

module.exports = generateToken;
