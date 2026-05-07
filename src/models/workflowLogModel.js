const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const WorkflowLog = sequelize.define(
    "WorkflowLog",
    {
        id: {
            type: DataTypes.UUID,
            defaultValue: DataTypes.UUIDV4,
            primaryKey: true,
        },
        request_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        actor_id: {
            type: DataTypes.UUID,
            allowNull: false,
        },
        previous_status: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        new_status: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        comment: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    },
    {
        tableName: "workflow_logs",
        timestamps: true,
        createdAt: "created_at",
        updatedAt: false,
    }
);

module.exports = WorkflowLog;
