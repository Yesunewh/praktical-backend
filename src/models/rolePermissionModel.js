const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const RolePermission = sequelize.define(
    "RolePermission",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        role_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Roles", key: "id" },
        },
        permission_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: { model: "Permissions", key: "id" },
        },
    },
    {
        timestamps: true,
        tableName: "RolePermissions",
    }
);

module.exports = RolePermission;
