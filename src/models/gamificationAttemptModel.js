const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GamificationAttempt = sequelize.define(
  "GamificationAttempt",
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
    challenge_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: "LearningChallenges", key: "id" },
    },
    score: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    passed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    time_spent_sec: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    started_at: { type: DataTypes.DATE, allowNull: true },
    completed_at: { type: DataTypes.DATE, allowNull: true },
    step_answers: { type: DataTypes.JSONB, allowNull: true },
  },
  {
    timestamps: true,
    tableName: "GamificationAttempts",
  }
);

module.exports = GamificationAttempt;
