const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserPermission = sequelize.define(
  "UserPermission",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    assignment_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "UserAssignments", key: "id" },
    },
    permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: { model: "Permissions", key: "id" },
    },
  },
  {
    timestamps: true,
    tableName: "UserPermissions",
  }
);

module.exports = UserPermission;
