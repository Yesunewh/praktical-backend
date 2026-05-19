const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RegistrationRejectionLog = sequelize.define(
  "RegistrationRejectionLog",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    first_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    last_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    phone_number: {
      type: DataTypes.STRING(15),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    unit_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    dept_id: {
      type: DataTypes.UUID,
      allowNull: true,
    },
    rejected_by: {
      type: DataTypes.UUID,
      allowNull: false,
    },
    rejection_reason: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    rejected_at: {
      type: DataTypes.DATE,
      defaultValue: DataTypes.NOW,
    },
  },
  {
    timestamps: false,
    tableName: "RegistrationRejectionLogs",
  }
);

module.exports = RegistrationRejectionLog;
