const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UserGamificationAchievement = sequelize.define(
  "UserGamificationAchievement",
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
    achievement_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: "GamificationAchievements", key: "id" },
    },
    progress: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    completed: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
    completed_at: { type: DataTypes.DATE, allowNull: true },
  },
  {
    timestamps: true,
    tableName: "UserGamificationAchievements",
    indexes: [{ unique: true, fields: ["user_id", "achievement_id"] }],
  }
);

module.exports = UserGamificationAchievement;
