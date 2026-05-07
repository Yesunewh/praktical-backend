const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Roles: tenant custom roles (`org_id` set) or global template baselines (`org_id` null).
 * `baseline_key` set on org-owned rows that mirror a seeded system baseline (editable per org).
 * `name` is not globally unique — same display names may exist across orgs once baselines were cloned.
 */
const Role = sequelize.define(
  "Role",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    baseline_key: {
      type: DataTypes.STRING(64),
      allowNull: true,
      comment:
        "If set with org_id, row is tenant-editable clone of template (baseline_default_learner, etc.)",
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "Organizations",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    tableName: "Roles",
  }
);

module.exports = Role;
