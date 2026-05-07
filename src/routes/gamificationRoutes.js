const express = require("express");
const router = express.Router();
const {
  listChallenges,
  getChallenge,
  completeChallenge,
  progressMe,
  achievementsMe,
  leaderboard,
  createLeaderboardSnapshot,
  listLeaderboardSnapshots,
  createChallenge,
  updateChallenge,
  removeChallenge,
  myTrainingAssignments,
  createTrainingAssignment,
  listTrainingAssignmentsAdmin,
  removeTrainingAssignment,
  adminTrainingSummary,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  rateChallenge,
} = require("../controllers/gamificationController");
const { protect, authorize } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

router.use(protect);

router.get("/categories", listCategories);
router.post("/categories", authorize("SUPERADMIN"), upload.single("image"), createCategory);
router.put("/categories/:id", authorize("SUPERADMIN"), upload.single("image"), updateCategory);
router.delete("/categories/:id", authorize("SUPERADMIN"), removeCategory);
router.get("/challenges", listChallenges);
router.get("/challenges/:id", getChallenge);
router.post("/challenges/:id/rate", rateChallenge);
router.post("/challenges/:id/complete", completeChallenge);
router.get(
  "/training-summary",
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  adminTrainingSummary
);
router.get("/progress/me", progressMe);
router.get("/assignments/me", myTrainingAssignments);
router.get(
  "/assignments",
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  listTrainingAssignmentsAdmin
);
router.post(
  "/assignments",
  authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"),
  createTrainingAssignment
);
router.delete(
  "/assignments/:id",
  authorize("SUPERADMIN", "ORG_ADMIN", "UNIT_ADMIN"),
  removeTrainingAssignment
);
router.get("/achievements/me", achievementsMe);
router.get("/leaderboard", leaderboard);
router.post(
  "/leaderboard/snapshot",
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  createLeaderboardSnapshot
);
router.get(
  "/leaderboard/snapshots",
  authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"),
  listLeaderboardSnapshots
);

router.post("/challenges", authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"), createChallenge);
router.put("/challenges/:id", authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"), updateChallenge);
router.delete("/challenges/:id", authorize("SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"), removeChallenge);

module.exports = router;
