const socketIo = require("socket.io");

let io;

module.exports = {
    /**
     * Initialize Socket.io
     * @param {Object} httpServer - The HTTP server instance
     * @returns {Object} - The io instance
     */
    init: (httpServer) => {
        io = socketIo(httpServer, {
            cors: {
                origin: "*", // Adjust this in production
                methods: ["GET", "POST", "PATCH", "DELETE"],
            },
        });

        // JWT Authentication Middleware for Socket.io
        io.use(async (socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.token;
                if (!token) {
                    return next(new Error("Authentication error: No token provided"));
                }

                const jwt = require("jsonwebtoken");
                const User = require("../models/userModel");
                const UserAssignment = require("../models/userAssignment");
                const AdministrativeUnit = require("../models/administrativeUnitModel");
                const Role = require("../models/roleModel");

                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const tokenPayload = decoded.payload || decoded;
                const userId = tokenPayload.user_id;

                const user = await User.findByPk(userId);
                if (!user || user.status === "DEACTIVATED") {
                    return next(new Error("Authentication error: User invalid or deactivated"));
                }

                // Fetch assignment to determine roles and rooms
                const assignment = await UserAssignment.findOne({ where: { user_id: userId } });
                if (assignment) {
                    const unit = await AdministrativeUnit.findByPk(assignment.unit_id);
                    const role = await Role.findByPk(assignment.role_id);

                    // Attach context to socket
                    socket.user = {
                        id: userId,
                        unit: unit ? { id: unit.id, level: unit.level, type: unit.type } : null,
                        role: role ? { name: role.name } : null
                    };
                }

                next();
            } catch (err) {
                return next(new Error("Authentication error: Invalid token"));
            }
        });

        io.on("connection", (socket) => {
            console.log(`User connected: ${socket.user?.id} (${socket.id})`);

            if (socket.user?.id) {
                const personalRoom = `user_${socket.user.id}`;
                socket.join(personalRoom);
                console.log(`User ${socket.user.id} joined personal room: ${personalRoom}`);
            }

            // 1. Join Facility-Specific Room
            // Only for HEALTH_CENTER roles (Facility Workers/Admins)
            const roleName = socket.user?.role?.name;
            const unitId = socket.user?.unit?.id;

            if (unitId && (roleName === "FACILITY" || roleName === "HEALTH_CENTER_ADMIN")) {
                const roomName = `referrals_hc_${unitId}`;
                socket.join(roomName);
                console.log(`User ${socket.user.id} joined room: ${roomName}`);
            }

            socket.on("disconnect", () => {
                console.log(`User disconnected: ${socket.id}`);
            });
        });

        return io;
    },

    /**
     * Get the initialized io instance
     * @returns {Object} - The io instance
     * @throws {Error} - If socket.io is not initialized
     */
    getIO: () => {
        if (!io) {
            throw new Error("Socket.io not initialized!");
        }
        return io;
    },
};
