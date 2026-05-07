const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const User = sequelize.define(
  "User",
  {
    user_id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      unique: true,
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
      unique: true,
    },
    email: {
      type: DataTypes.STRING(100),
      allowNull: true,
      unique: true,
    },
    username: {
      type: DataTypes.STRING(100),
      allowNull: true, // Optional for now, or unique if required
      unique: true,
    },
    language_preference: {
      type: DataTypes.ENUM("eng", "am", "orm", "som", "tir", "sid"),
      defaultValue: "eng",
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM("UNASSIGNED", "ACTIVE", "DEACTIVATED"),
      defaultValue: "UNASSIGNED",
    },
    user_type: {
      type: DataTypes.ENUM("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN", "DEPT_ADMIN", "STAFF", "EXTERNAL"), 
      allowNull: false,
      defaultValue: "STAFF",
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "Organizations",
        key: "id",
      },
    },
    dept_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "Departments",
        key: "id",
      },
    },
    unit_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "OrganizationalUnits",
        key: "id",
      },
    },

    mustChangePassword: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      allowNull: true,
    },

    // Gamification (optional; synced from LearningChallenges completion)
    gamification_xp: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    gamification_level: {
      type: DataTypes.STRING(32),
      defaultValue: "beginner",
      allowNull: false,
    },
    gamification_xp_to_next: {
      type: DataTypes.INTEGER,
      defaultValue: 1000,
      allowNull: false,
    },
    gamification_reputation: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    gamification_streak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    gamification_longest_streak: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
      allowNull: false,
    },
    gamification_last_activity: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
  },
  {
    timestamps: true,
    tableName: "Users",
  }
);

module.exports = User;
