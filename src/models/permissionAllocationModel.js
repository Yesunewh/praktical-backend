const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const PermissionAllocation = sequelize.define(
  "PermissionAllocation",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    permission_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Permissions",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    allocation_type: {
      type: DataTypes.ENUM("SYSTEM", "ORGANIZATION", "UNIT"),
      allowNull: false,
      defaultValue: "SYSTEM",
    },
    allocation_id: {
      type: DataTypes.UUID,
      allowNull: true, // Null means it's a globally assigned system permission
    },
    effect: {
      type: DataTypes.ENUM("GRANT", "DENY"),
      defaultValue: "GRANT",
    },
  },
  {
    timestamps: true,
    tableName: "PermissionAllocations",
  }
);

module.exports = PermissionAllocation;
