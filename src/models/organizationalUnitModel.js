const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const OrganizationalUnit = sequelize.define(
  "OrganizationalUnit",
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    name: {
      type: DataTypes.STRING(255),
      allowNull: false,
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
    type_id: {
      type: DataTypes.UUID,
      allowNull: false,
      references: {
        model: "UnitTypes",
        key: "id",
      },
      onDelete: "RESTRICT",
    },
    parent_id: {
      type: DataTypes.UUID,
      allowNull: true,
      references: {
        model: "OrganizationalUnits",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    status: {
      type: DataTypes.ENUM("ACTIVE", "INACTIVE"),
      defaultValue: "ACTIVE",
    },
  },
  {
    timestamps: true,
    paranoid: true, // Enables soft deletes
    tableName: "OrganizationalUnits",
  }
);

module.exports = OrganizationalUnit;
