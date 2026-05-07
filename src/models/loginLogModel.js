const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const LoginLog = sequelize.define(
    "LoginLog",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        user_id: {
            type: DataTypes.UUID,
            allowNull: true,
            references: {
                model: "Users",
                key: "user_id",
            },
        },
        identifier: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ip_address: {
            type: DataTypes.STRING(45),
            allowNull: true,
        },
        user_agent: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM("SUCCESS", "FAILED"),
            allowNull: false,
        },
        failure_reason: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    },
    {
        timestamps: true,
        tableName: "LoginLogs",
    }
);

module.exports = LoginLog;
