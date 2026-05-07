const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const AuditLog = sequelize.define(
  "AuditLog",
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
      allowNull: false,
      references: { model: "OrganizationalUnits", key: "id" },
    },
    action: { type: DataTypes.STRING(255), allowNull: false },
    target_id: { type: DataTypes.UUID, allowNull: true },
    metadata: { type: DataTypes.JSON, allowNull: true },
    timestamp: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
  },
  {
    timestamps: false,
    tableName: "AuditLogs",
  }
);

module.exports = AuditLog;
