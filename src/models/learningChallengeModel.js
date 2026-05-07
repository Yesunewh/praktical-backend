const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LearningChallenge = sequelize.define(
  "LearningChallenge",
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
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
    unit_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "OrganizationalUnits", key: "id" },
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    type: { type: DataTypes.STRING(32), allowNull: false },
    category: { type: DataTypes.STRING(64), allowNull: false },
    difficulty: { type: DataTypes.STRING(32), allowNull: false },
    duration: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    xp_reward: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    reputation_reward: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    steps: { type: DataTypes.JSONB, allowNull: false, defaultValue: [] },
    is_active: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
  },
  {
    timestamps: true,
    tableName: "LearningChallenges",
  }
);

module.exports = LearningChallenge;
