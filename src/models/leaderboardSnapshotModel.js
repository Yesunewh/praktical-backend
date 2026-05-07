const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LeaderboardSnapshot = sequelize.define(
  "LeaderboardSnapshot",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    captured_at: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
    },
    scope: {
      type: DataTypes.ENUM("GLOBAL", "ORG", "DEPT"),
      allowNull: false,
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "Organizations", key: "id" },
    },
    dept_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "Departments", key: "id" },
    },
    period: {
      type: DataTypes.ENUM("MANUAL", "DAILY", "WEEKLY"),
      allowNull: false,
      defaultValue: "MANUAL",
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
      defaultValue: [],
    },
    created_by_user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "Users", key: "user_id" },
    },
  },
  {
    timestamps: true,
    tableName: "LeaderboardSnapshots",
    indexes: [
      { fields: ["scope", "org_id", "dept_id", "captured_at"] },
    ],
  }
);

module.exports = LeaderboardSnapshot;
