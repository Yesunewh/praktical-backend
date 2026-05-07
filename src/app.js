const express = require("express");
const userRoutes = require("./routes/userRoutes");
const orgRoutes = require("./routes/orgRoutes");
const deptRoutes = require("./routes/deptRoutes");

const { errorMiddleware } = require("./middlewares/errorMiddleware");
const cors = require("cors");
const { swaggerUi, swaggerSpec } = require("./config/swagger");
const path = require("path");

const i18nMiddleware = require("./middlewares/i18nMiddleware");
const app = express();

app.use(cors({
  origin: true, // Allow all origins (or you can put your frontend URL here)
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"]
}));
app.use(express.json());
app.use(i18nMiddleware);
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

// Root route for cPanel health checks
app.get("/", (req, res) => {
  res.status(200).send("Practikal Backend is running");
});

app.use("/api/docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// --- CORE ROUTES ---
const unitRoutes = require("./routes/unitRoutes");
const permissionRoutes = require("./routes/permissionRoutes");
const roleRoutes = require("./routes/roleRoutes");
const gamificationRoutes = require("./routes/gamificationRoutes");

app.use("/api/users", userRoutes);
app.use("/api/organizations", orgRoutes);
app.use("/api/departments", deptRoutes);
app.use("/api/units", unitRoutes);
app.use("/api/permissions", permissionRoutes);
app.use("/api/roles", roleRoutes);
app.use("/api/gamification", gamificationRoutes);

app.use(errorMiddleware);

module.exports = app;
