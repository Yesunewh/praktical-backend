const User = require("./userModel");
const Organization = require("./organizationModel");
const Department = require("./departmentModel");
const UnitType = require("./unitTypeModel");
const OrganizationalUnit = require("./organizationalUnitModel");

const Role = require("./roleModel");
const Permission = require("./permissionModel");
const UserAssignment = require("./userAssignment");
const UserPermission = require("./userPermissionModel"); // Repurposed for Overrides
const RolePermission = require("./rolePermissionModel"); // New Role-based permissions
const PermissionAllocation = require("./permissionAllocationModel");
const AuditLog = require("./auditLogModel");
const LoginLog = require("./loginLogModel");
const LearningChallenge = require("./learningChallengeModel");
const GamificationAttempt = require("./gamificationAttemptModel");
const GamificationAchievement = require("./gamificationAchievementModel");
const UserGamificationAchievement = require("./userGamificationAchievementModel");
const LeaderboardSnapshot = require("./leaderboardSnapshotModel");
const LearnerTrainingAssignment = require("./learnerTrainingAssignmentModel");
const LearningChallengeCategory = require("./learningChallengeCategoryModel");
const GamificationRating = require("./gamificationRatingModel");
const RegistrationRejectionLog = require("./registrationRejectionLogModel");

// User -> UserAssignment
User.hasMany(UserAssignment, { foreignKey: "user_id" });
UserAssignment.belongsTo(User, { foreignKey: "user_id" });

// Unit -> UserAssignment
OrganizationalUnit.hasMany(UserAssignment, { foreignKey: "unit_id" });
UserAssignment.belongsTo(OrganizationalUnit, { foreignKey: "unit_id" });

// Role -> UserAssignment
Role.hasMany(UserAssignment, { foreignKey: "role_id" });
UserAssignment.belongsTo(Role, { foreignKey: "role_id" });

// Hierarchy: Organization -> UnitType
Organization.hasMany(UnitType, { foreignKey: "org_id", as: "UnitTypes" });
UnitType.belongsTo(Organization, { foreignKey: "org_id" });

// Hierarchy: Organization -> OrganizationalUnit
Organization.hasMany(OrganizationalUnit, { foreignKey: "org_id", as: "Units" });
OrganizationalUnit.belongsTo(Organization, { foreignKey: "org_id" });

// Hierarchy: UnitType -> OrganizationalUnit
UnitType.hasMany(OrganizationalUnit, { foreignKey: "type_id", as: "Instances" });
OrganizationalUnit.belongsTo(UnitType, { foreignKey: "type_id", as: "Type" });

// Hierarchy: OrganizationalUnit Self-reference 
OrganizationalUnit.hasMany(OrganizationalUnit, { foreignKey: "parent_id", as: "SubUnits" });
OrganizationalUnit.belongsTo(OrganizationalUnit, { foreignKey: "parent_id", as: "ParentUnit" });

// Hierarchy: OrganizationalUnit -> Department
OrganizationalUnit.hasMany(Department, { foreignKey: "unit_id", as: "Departments" });
Department.belongsTo(OrganizationalUnit, { foreignKey: "unit_id" });

// Hierarchy: OrganizationalUnit -> User
OrganizationalUnit.hasMany(User, { foreignKey: "unit_id", as: "UnitStaff" });
User.belongsTo(OrganizationalUnit, { foreignKey: "unit_id" });

// --- HYBRID RBAC ASSOCIATIONS ---

// 1. Role-based Permissions (The Standard)
Role.belongsToMany(Permission, {
  through: RolePermission,
  foreignKey: "role_id",
});
Permission.belongsToMany(Role, {
  through: RolePermission,
  foreignKey: "permission_id",
});

Role.hasMany(RolePermission, { foreignKey: "role_id" });
RolePermission.belongsTo(Role, { foreignKey: "role_id" });

Permission.hasMany(RolePermission, { foreignKey: "permission_id" });
RolePermission.belongsTo(Permission, { foreignKey: "permission_id" });

// 2. User-specific Overrides (The Exception)
UserAssignment.hasMany(UserPermission, { foreignKey: "assignment_id" });
UserPermission.belongsTo(UserAssignment, { foreignKey: "assignment_id" });

Permission.hasMany(UserPermission, { foreignKey: "permission_id" });
UserPermission.belongsTo(Permission, { foreignKey: "permission_id" });

// AuditLog associations
AuditLog.belongsTo(User, { foreignKey: "user_id" });
AuditLog.belongsTo(OrganizationalUnit, { foreignKey: "unit_id" });

// --- FAMILY & DEPENDENT ASSOCIATIONS ---

User.hasMany(LoginLog, { foreignKey: "user_id" });
LoginLog.belongsTo(User, { foreignKey: "user_id" });

// --- PRACTIKAL MULTI-TENANT HIERARCHY ---

// Organization -> Department
Organization.hasMany(Department, { foreignKey: "org_id", as: "Departments" });
Department.belongsTo(Organization, { foreignKey: "org_id" });

// Organization -> User
Organization.hasMany(User, { foreignKey: "org_id", as: "Staff" });
User.belongsTo(Organization, { foreignKey: "org_id" });

// Organization -> Role
Organization.hasMany(Role, { foreignKey: "org_id", as: "CustomRoles" });
Role.belongsTo(Organization, { foreignKey: "org_id" });

// Permission -> PermissionAllocation
Permission.hasMany(PermissionAllocation, { foreignKey: "permission_id" });
PermissionAllocation.belongsTo(Permission, { foreignKey: "permission_id" });

// Department -> User
Department.hasMany(User, { foreignKey: "dept_id", as: "DepartmentStaff" });
User.belongsTo(Department, { foreignKey: "dept_id" });

// --- GAMIFICATION ---
Organization.hasMany(LearningChallenge, { foreignKey: "org_id", as: "LearningChallenges" });
LearningChallenge.belongsTo(Organization, { foreignKey: "org_id" });
Department.hasMany(LearningChallenge, { foreignKey: "dept_id", as: "DepartmentChallenges" });
LearningChallenge.belongsTo(Department, { foreignKey: "dept_id", as: "Department" });

User.hasMany(GamificationAttempt, { foreignKey: "user_id" });
GamificationAttempt.belongsTo(User, { foreignKey: "user_id" });
LearningChallenge.hasMany(GamificationAttempt, { foreignKey: "challenge_id", as: "attempts" });
GamificationAttempt.belongsTo(LearningChallenge, { foreignKey: "challenge_id", as: "challenge" });

User.hasMany(UserGamificationAchievement, { foreignKey: "user_id" });
UserGamificationAchievement.belongsTo(User, { foreignKey: "user_id" });
GamificationAchievement.hasMany(UserGamificationAchievement, { foreignKey: "achievement_id" });
UserGamificationAchievement.belongsTo(GamificationAchievement, { foreignKey: "achievement_id" });

User.hasMany(GamificationRating, { foreignKey: "user_id" });
GamificationRating.belongsTo(User, { foreignKey: "user_id" });
LearningChallenge.hasMany(GamificationRating, { foreignKey: "challenge_id", as: "ratings" });
GamificationRating.belongsTo(LearningChallenge, { foreignKey: "challenge_id" });

module.exports = {
  User,
  Organization,
  Department,
  UnitType,
  OrganizationalUnit,
  Role,
  Permission,
  PermissionAllocation,
  UserAssignment,
  UserPermission,
  RolePermission,
  AuditLog,
  LoginLog,
  LearningChallenge,
  GamificationAttempt,
  GamificationAchievement,
  UserGamificationAchievement,
  LeaderboardSnapshot,
  LearnerTrainingAssignment,
  LearningChallengeCategory,
  GamificationRating,
  RegistrationRejectionLog,
};
