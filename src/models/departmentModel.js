const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const Department = sequelize.define(
  "Department",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Organizations",
        key: "id",
      },
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    unit_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "OrganizationalUnits",
        key: "id",
      },
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      defaultValue: "ACTIVE",
    },
  },
  {
    timestamps: true,
    tableName: "Departments",
  }
);

module.exports = Department;
