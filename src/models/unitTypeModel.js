const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const UnitType = sequelize.define(
  "UnitType",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
      // e.g., "City", "Subcity", "Woreda", "Region", "Zone"
    },
    level: {
      type: DataTypes.INTEGER,
      allowNull: false,
      validate: {
        min: 1,
        max: 5, // Enforcing Max level up to 5 per user request
      },
      // e.g., 1 for top-level unit under the organization, 2 for the next, 5 for the bottom.
    },
    org_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "Organizations",
        key: "id",
      },
      onDelete: "CASCADE",
    },
  },
  {
    timestamps: true,
    tableName: "UnitTypes",
  }
);

module.exports = UnitType;
