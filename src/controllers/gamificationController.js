const gamificationService = require("../services/gamificationService");
const { AppError } = require("../middlewares/errorMiddleware");

const listChallenges = async (req, res, next) => {
  try {
    const { category, difficulty, org_id, dept_id, unit_id, for_exam_bank } = req.query;
    const examBank = for_exam_bank === "1" || for_exam_bank === "true";
    const ut = req.user?.user_type;

    if (examBank) {
      if (!["SUPERADMIN", "ORG_ADMIN", "DEPT_ADMIN", "UNIT_ADMIN"].includes(ut)) {
        return next(new AppError("Forbidden", 403));
      }
      const filterOrgId = ut === "SUPERADMIN" ? org_id || null : null;
      const filterDeptId = ut === "SUPERADMIN" ? dept_id || null : null;
      const filterUnitId = ut === "SUPERADMIN" ? unit_id || null : null;
      const list = await gamificationService.listChallengesAdmin({
        category,
        difficulty,
        viewer: req.user,
        filterOrgId,
        filterDeptId,
        filterUnitId,
      });
      return res.json({ success: true, challenges: list });
    }

    const filterOrgId = ut === "SUPERADMIN" ? org_id || null : null;
    const filterDeptId = ut === "SUPERADMIN" ? dept_id || null : null;
    const filterUnitId = ut === "SUPERADMIN" ? unit_id || null : null;
    const list = await gamificationService.listChallenges({
      category,
      difficulty,
      viewer: req.user,
      filterOrgId,
      filterDeptId,
      filterUnitId,
    });
    res.json({ success: true, challenges: list });
  } catch (e) {
    next(e);
  }
};

const getChallenge = async (req, res, next) => {
  try {
    const c = await gamificationService.getChallengeById(req.params.id, req.user);
    res.json({ success: true, challenge: c });
  } catch (e) {
    next(e);
  }
};

const listCategories = async (req, res, next) => {
  try {
    const cats = await gamificationService.listCategories();
    res.json({ success: true, categories: cats });
  } catch (e) {
    next(e);
  }
};

const createCategory = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.image_url = `/uploads/${req.file.filename}`;
    }
    const cat = await gamificationService.createCategory(data);
    res.json({ success: true, category: cat });
  } catch (e) {
    next(e);
  }
};

const updateCategory = async (req, res, next) => {
  try {
    const data = { ...req.body };
    if (req.file) {
      data.image_url = `/uploads/${req.file.filename}`;
    }
    const cat = await gamificationService.updateCategory(req.params.id, data);
    res.json({ success: true, category: cat });
  } catch (e) {
    next(e);
  }
};

const removeCategory = async (req, res, next) => {
  try {
    await gamificationService.deleteCategory(req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

const rateChallenge = async (req, res, next) => {
  try {
    const userId = req.user?.user_id || req.user?.id;
    if (!userId) {
      console.error("Rate Challenge Error: No user ID found in request", req.user);
      return next(new AppError("Unauthorized", 401));
    }
    console.log(`Controller: User ${userId} is rating challenge ${req.params.id}`);
    const result = await gamificationService.rateChallenge(userId, req.params.id, req.body || {});
    res.json({ success: true, rating: result });
  } catch (e) {
    console.error("Controller: Rate Challenge Exception", e);
    next(e);
  }
};

const completeChallenge = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return next(new AppError("Unauthorized", 401));
    const result = await gamificationService.completeChallenge(userId, req.params.id, req.body || {});
    res.json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
};

const progressMe = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return next(new AppError("Unauthorized", 401));
    const data = await gamificationService.getProgressMe(userId);
    res.json({ success: true, ...data });
  } catch (e) {
    next(e);
  }
};

const achievementsMe = async (req, res, next) => {
  try {
    const userId = req.user?.user_id;
    if (!userId) return next(new AppError("Unauthorized", 401));
    const list = await gamificationService.getAchievementsForUser(userId);
    res.json({ success: true, achievements: list });
  } catch (e) {
    next(e);
  }
};

const leaderboard = async (req, res, next) => {
  try {
    const { org_id, dept_id, unit_id, limit, scope, offset } = req.query;
    let sc = scope;
    if (!sc) {
      sc = req.user?.user_type === "SUPERADMIN" ? "global" : "org";
    }
    const orgId = org_id || req.user?.org_id;
    const norm = gamificationService.normalizeLeaderboardScope(sc);
    const deptId = dept_id || (norm === "dept" ? req.user?.dept_id : undefined);
    const unitId = unit_id || (norm === "unit" ? req.user?.unit_id : undefined);
    
    const rows = await gamificationService.getLeaderboard({
      scope: sc,
      orgId,
      deptId,
      unitId,
      limit,
      offset,
      requester: req.user,
    });
    res.json({ success: true, leaderboard: rows });
  } catch (e) {
    console.error("[Leaderboard Controller Error]:", e);
    next(e);
  }
};

const createLeaderboardSnapshot = async (req, res, next) => {
  try {
    const result = await gamificationService.createLeaderboardSnapshot(req.user, req.body || {});
    res.status(201).json({ success: true, ...result });
  } catch (e) {
    next(e);
  }
};

const listLeaderboardSnapshots = async (req, res, next) => {
  try {
    const { limit, scope, org_id, dept_id } = req.query;
    const rows = await gamificationService.listLeaderboardSnapshots(req.user, {
      limit,
      scope,
      org_id,
      dept_id,
    });
    res.json({ success: true, snapshots: rows });
  } catch (e) {
    next(e);
  }
};

const createChallenge = async (req, res, next) => {
  try {
    const c = await gamificationService.upsertChallenge(req.body, false, req.user);
    res.status(201).json({ success: true, challenge: c });
  } catch (e) {
    next(e);
  }
};

const updateChallenge = async (req, res, next) => {
  try {
    const c = await gamificationService.upsertChallenge({ ...req.body, id: req.params.id }, true, req.user);
    res.json({ success: true, challenge: c });
  } catch (e) {
    next(e);
  }
};

const removeChallenge = async (req, res, next) => {
  try {
    await gamificationService.deleteChallenge(req.params.id, req.user);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

const myTrainingAssignments = async (req, res, next) => {
  try {
    const assignments = await gamificationService.listMyTrainingAssignments(req.user);
    res.json({ success: true, assignments });
  } catch (e) {
    next(e);
  }
};

const createTrainingAssignment = async (req, res, next) => {
  try {
    const assignment = await gamificationService.createTrainingAssignment(req.user, req.body || {});
    res.status(201).json({ success: true, assignment });
  } catch (e) {
    next(e);
  }
};

const listTrainingAssignmentsAdmin = async (req, res, next) => {
  try {
    const assignments = await gamificationService.listTrainingAssignmentsForAdmin(req.user, req.query || {});
    res.json({ success: true, assignments });
  } catch (e) {
    next(e);
  }
};

const removeTrainingAssignment = async (req, res, next) => {
  try {
    await gamificationService.deleteTrainingAssignment(req.user, req.params.id);
    res.json({ success: true });
  } catch (e) {
    next(e);
  }
};

const adminTrainingSummary = async (req, res, next) => {
  try {
    const summary = await gamificationService.getAdminTrainingSummary(req.user, req.query || {});
    res.json({ success: true, summary });
  } catch (e) {
    next(e);
  }
};

module.exports = {
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
  listCategories,
  createCategory,
  updateCategory,
  removeCategory,
  rateChallenge,
  myTrainingAssignments,
  createTrainingAssignment,
  listTrainingAssignmentsAdmin,
  removeTrainingAssignment,
  adminTrainingSummary,
};
