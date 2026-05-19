const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Organization = sequelize.define(
  "Organization",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      unique: true,
    },
    logo_url: {
      type: DataTypes.STRING(500),
      allowNull: true,
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "SUSPENDED", "PENDING"),
      defaultValue: "ACTIVE",
    },
    subscription_plan: {
      type: DataTypes.ENUM("BASIC", "PREMIUM", "ENTERPRISE"),
      defaultValue: "BASIC",
    },
  },
  {
    timestamps: true,
    tableName: "Organizations",
  }
);

module.exports = Organization;
