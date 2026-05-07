const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserAssignment = sequelize.define(
  "UserAssignment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    user_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "Users", key: "user_id" },
    },
    unit_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "OrganizationalUnits", key: "id" },
    },
    role_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "Roles", key: "id" },
    },
  },
  {
    timestamps: true,
    tableName: "UserAssignments",
  }
);

module.exports = UserAssignment;
