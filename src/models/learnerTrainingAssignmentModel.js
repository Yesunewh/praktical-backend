const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/** Due training rows shown on the learner dashboard (replaces browser-only campaign seeds). */
const LearnerTrainingAssignment = sequelize.define(
  "LearnerTrainingAssignment",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
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
    /** Set when the assignment targets one user; null when assign_all is true. */
    user_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: { model: "Users", key: "user_id" },
    },
    assign_all: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    challenge_id: {
      type: DataTypes.STRING(64),
      allowNull: false,
      references: { model: "LearningChallenges", key: "id" },
    },
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },
    due_date: {
      type: DataTypes.DATEONLY,
      allowNull: true,
    },
    campaign_type: {
      type: DataTypes.STRING(32),
      allowNull: false,
      defaultValue: "one_time",
    },
    trigger_type: {
      type: DataTypes.STRING(64),
      allowNull: true,
    },
    relative_days: {
      type: DataTypes.INTEGER,
      allowNull: true,
      defaultValue: 7,
    },
  },
  {
    timestamps: true,
    tableName: "LearnerTrainingAssignments",
  }
);

module.exports = LearnerTrainingAssignment;
