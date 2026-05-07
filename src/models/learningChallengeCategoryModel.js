const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LearningChallengeCategory = sequelize.define(
  "LearningChallengeCategory",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    display_name: {
      type: DataTypes.STRING(128),
      allowNull: false,
    },
    image_url: {
      type: DataTypes.STRING(512),
      allowNull: true,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "LearningChallengeCategories",
  }
);

module.exports = LearningChallengeCategory;
