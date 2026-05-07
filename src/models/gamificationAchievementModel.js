const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GamificationAchievement = sequelize.define(
  "GamificationAchievement",
  {
    id: {
      type: DataTypes.STRING(64),
      primaryKey: true,
    },
    title: { type: DataTypes.STRING(255), allowNull: false },
    description: { type: DataTypes.TEXT, allowNull: true },
    icon: { type: DataTypes.STRING(64), allowNull: true },
    target_count: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    criteria_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "GamificationAchievements",
  }
);

module.exports = GamificationAchievement;
