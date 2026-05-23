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
  getAssignmentReport,
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  rateChallenge,
  topRatedChallenges,
  getTranslationGroup,
} = require("../controllers/gamificationController");
const { protect, assignmentMiddleware, permissionMiddleware } = require("../middlewares/authMiddleware");
const { upload } = require("../middlewares/uploadMiddleware");

router.use(protect);
router.use(assignmentMiddleware);

router.get("/categories", listCategories);
router.post("/categories", permissionMiddleware("MANAGE_CHALLENGES"), upload.single("image"), createCategory);
router.put("/categories/:id", permissionMiddleware("MANAGE_CHALLENGES"), upload.single("image"), updateCategory);
router.delete("/categories/:id", permissionMiddleware("MANAGE_CHALLENGES"), removeCategory);
router.get("/challenges", listChallenges);
router.get("/challenges/:id", getChallenge);
router.get("/translation-group/:groupId", getTranslationGroup);
router.post("/challenges/:id/rate", rateChallenge);
router.post("/challenges/:id/complete", completeChallenge);
router.get(
  "/training-summary",
  permissionMiddleware("VIEW_REPORTS"),
  adminTrainingSummary
);
router.get("/progress/me", progressMe);
router.get("/assignments/me", myTrainingAssignments);
router.get(
  "/assignments",
  permissionMiddleware("VIEW_REPORTS"),
  listTrainingAssignmentsAdmin
);
router.get(
  "/assignments/:id/report",
  permissionMiddleware("VIEW_REPORTS"),
  getAssignmentReport
);
router.get(
  "/analytics/top-rated",
  permissionMiddleware("VIEW_REPORTS"),
  topRatedChallenges
);
router.post(
  "/assignments",
  permissionMiddleware("MANAGE_CAMPAIGNS"),
  createTrainingAssignment
);
router.delete(
  "/assignments/:id",
  permissionMiddleware("MANAGE_CAMPAIGNS"),
  removeTrainingAssignment
);
router.get("/achievements/me", achievementsMe);
router.get("/leaderboard", leaderboard);
router.post(
  "/leaderboard/snapshot",
  permissionMiddleware("VIEW_REPORTS"),
  createLeaderboardSnapshot
);
router.get(
  "/leaderboard/snapshots",
  permissionMiddleware("VIEW_REPORTS"),
  listLeaderboardSnapshots
);

router.post("/challenges", permissionMiddleware("MANAGE_CHALLENGES"), createChallenge);
router.put("/challenges/:id", permissionMiddleware("MANAGE_CHALLENGES"), updateChallenge);
router.delete("/challenges/:id", permissionMiddleware("MANAGE_CHALLENGES"), removeChallenge);

module.exports = router;
