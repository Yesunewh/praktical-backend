const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const GamificationRating = sequelize.define(
  "GamificationRating",
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
    rating: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5,
      },
    },
    review_text: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "GamificationRatings",
    indexes: [
      {
        unique: true,
        fields: ["user_id", "challenge_id"],
        name: "gamification_ratings_user_challenge_unique",
      },
    ],
  }
);

module.exports = GamificationRating;
