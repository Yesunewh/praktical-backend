const { Op, QueryTypes } = require("sequelize");
const {
  User,
  Organization,
  Department,
  LearningChallenge,
  GamificationAttempt,
  GamificationAchievement,
  UserGamificationAchievement,
  LeaderboardSnapshot,
  LearnerTrainingAssignment,
  LearningChallengeCategory,
  GamificationRating,
  OrganizationalUnit,
} = require("../models");
const { AppError } = require("../middlewares/errorMiddleware");
const sequelize = require("../config/database");
const {
  buildChallengeVisibilityWhere,
  userCanAccessChallenge,
  assertAuthorCanUpsertChallenge,
  assertAuthorCanMutateExistingChallenge,
} = require("./gamificationPolicy");
const { normalizePassed, PASS_SCORE_PERCENT } = require("../constants/challengeProgression");
const {
  getPassedChallengeIdSet,
  evaluateProgressionLockForChallenge,
} = require("./challengeProgressionService");
const { validateGamificationSteps } = require("../utils/challengeStepValidation");

function computeLevel(xp) {
  const n = Number(xp) || 0;
  if (n < 1000) return { level: "beginner", xpToNext: 1000 - n };
  if (n < 5000) return { level: "medior", xpToNext: 5000 - n };
  if (n < 10000) return { level: "senior", xpToNext: 10000 - n };
  if (n < 20000) return { level: "professional", xpToNext: 20000 - n };
  if (n < 35000) return { level: "specialist", xpToNext: 35000 - n };
  if (n < 50000) return { level: "master", xpToNext: 50000 - n };
  return { level: "legend", xpToNext: 0 };
}

async function loadVisibleChallengePlains(viewer, filterOrgId, filterDeptId, filterUnitId) {
  const vis = await buildChallengeVisibilityWhere(viewer, {
    filterOrgId: filterOrgId || null,
    filterDeptId: filterDeptId || null,
    filterUnitId: filterUnitId || null,
  });
  const rows = await LearningChallenge.findAll({
    where: { is_active: true, ...vis },
    order: [["id", "ASC"]],
  });
  return rows.map((r) => r.get({ plain: true }));
}

function toFrontendChallenge(row) {
  if (!row) return null;
  const plain = row.toJSON ? row.toJSON() : row;
  return {
    id: plain.id,
    title: plain.title,
    description: plain.description || "",
    type: plain.type,
    xpReward: plain.xp_reward,
    reputationReward: plain.reputation_reward,
    duration: plain.duration,
    difficulty: plain.difficulty,
    category: plain.category,
    steps: plain.steps || [],
  };
}

function streakUpdate(user, completedAt) {
  const today = new Date(completedAt);
  today.setUTCHours(0, 0, 0, 0);
  const todayStr = today.toISOString().slice(0, 10);

  let lastStr = user.gamification_last_activity
    ? new Date(user.gamification_last_activity).toISOString().slice(0, 10)
    : null;

  let streak = user.gamification_streak || 0;

  if (!lastStr) {
    streak = 1;
  } else if (lastStr === todayStr) {
    // same calendar day — keep streak
  } else {
    const last = new Date(lastStr + "T00:00:00.000Z");
    const diffDays = Math.round((today - last) / 86400000);
    if (diffDays === 1) streak += 1;
    else if (diffDays === 0) {
      /* noop */
    } else streak = 1;
  }

  const longest = Math.max(user.gamification_longest_streak || 0, streak);
  return { streak, longest, lastActivity: todayStr };
}

async function ensureUserAchievementRows(userId) {
  const defs = await GamificationAchievement.findAll();
  for (const d of defs) {
    await UserGamificationAchievement.findOrCreate({
      where: { user_id: userId, achievement_id: d.id },
      defaults: { progress: 0, completed: false },
    });
  }
}

async function recomputeAchievements(userId, user, transaction) {
  await ensureUserAchievementRows(userId);
  const passAttemptWhere = {
    user_id: userId,
    completed_at: { [Op.ne]: null },
    [Op.or]: [{ passed: true }, { score: { [Op.gte]: PASS_SCORE_PERCENT } }],
  };
  const passedCount = await GamificationAttempt.count({
    where: passAttemptWhere,
    transaction,
  });

  const passedAttempts = await GamificationAttempt.findAll({
    where: passAttemptWhere,
    attributes: ["challenge_id"],
    transaction,
  });
  const chIds = [...new Set(passedAttempts.map((a) => a.challenge_id))];
  const passedChallenges =
    chIds.length === 0
      ? []
      : await LearningChallenge.findAll({
          where: { id: { [Op.in]: chIds } },
          transaction,
        });
  const passwordCount = passedChallenges.filter((c) => c.category === "password").length;

  const unlocked = [];
  const defsById = new Map(
    (await GamificationAchievement.findAll({ transaction })).map((d) => [d.id, d])
  );
  const rows = await UserGamificationAchievement.findAll({
    where: { user_id: userId },
    transaction,
  });

  for (const row of rows) {
    const def = defsById.get(row.achievement_id);
    if (!def) continue;
    const wasCompleted = row.completed;
    let progress = row.progress;
    let completed = row.completed;

    switch (def.criteria_key) {
      case "first_pass":
        progress = Math.min(passedCount, def.target_count);
        completed = passedCount >= def.target_count;
        break;
      case "streak_7":
        progress = Math.min(user.gamification_streak || 0, def.target_count);
        completed = (user.gamification_streak || 0) >= def.target_count;
        break;
      case "password_category":
        progress = Math.min(passwordCount, def.target_count);
        completed = passwordCount >= def.target_count;
        break;
      default:
        break;
    }

    if (progress !== row.progress || completed !== row.completed) {
      await row.update(
        {
          progress,
          completed,
          completed_at:
            completed && !wasCompleted ? new Date() : row.completed_at || null,
        },
        { transaction }
      );
    }
    if (completed && !wasCompleted) unlocked.push(def);
  }

  return unlocked;
}

async function listChallenges(filters = {}) {
  const vis = await buildChallengeVisibilityWhere(filters.viewer, {
    filterOrgId: filters.filterOrgId || null,
    filterDeptId: filters.filterDeptId || null,
    filterUnitId: filters.filterUnitId || null,
  });

  const attemptCountSql = sequelize.literal(
    `(SELECT COUNT(*)::int FROM "GamificationAttempts" AS ga WHERE ga.challenge_id = "LearningChallenge"."id")`
  );

  const ratingAvgSql = sequelize.literal(
    `(SELECT CAST(COALESCE(AVG(rating), 0) AS FLOAT) FROM "GamificationRatings" AS gr WHERE gr.challenge_id = "LearningChallenge"."id")`
  );
  
  const ratingCountSql = sequelize.literal(
    `(SELECT CAST(COUNT(*) AS INTEGER) FROM "GamificationRatings" AS gr WHERE gr.challenge_id = "LearningChallenge"."id")`
  );

  const where = { is_active: true, ...vis };
  const allRows = await LearningChallenge.findAll({
    where,
    attributes: {
      include: [
        [attemptCountSql, "attempt_count"],
        [ratingAvgSql, "rating_avg"],
        [ratingCountSql, "rating_count"]
      ],
    },
    order: [["id", "ASC"]],
  });

  console.log(`Fetched ${allRows.length} challenges. Checking ratings for first few...`);
  if (allRows.length > 0) {
    const first = allRows[0].get({ plain: true });
    console.log(`- Challenge ${first.id}: rating_avg=${first.rating_avg}, count=${first.rating_count}`);
  }

  let rows = allRows;
  if (filters.category) rows = rows.filter((r) => r.category === filters.category);
  if (filters.difficulty) rows = rows.filter((r) => r.difficulty === filters.difficulty);

  const plainAll = allRows.map((r) => r.get({ plain: true }));
  const uid = filters.viewer?.user_id;
  const passedSet = uid ? await getPassedChallengeIdSet(uid) : null;

  // Use fixed random seed based on challenge ID for consistent "random" release date
  const getSeed = (str) => {
    let hash = 0;
    for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
    return Math.abs(hash);
  };

  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

  return rows.map((row) => {
    const base = toFrontendChallenge(row);
    const plain = row.get({ plain: true });
    
    const seed = getSeed(row.id);
    const month = months[seed % 12];
    const year = 2024 + (seed % 2);
    const releaseDate = `${month}. ${year}`;

    const challengeData = {
      ...base,
      orgId: plain.org_id != null ? plain.org_id : null,
      deptId: plain.dept_id != null ? plain.dept_id : null,
      unitId: plain.unit_id != null ? plain.unit_id : null,
      attemptCount: Number(plain.attempt_count || 0),
      rating: Number(plain.rating_avg || 0),
      ratingCount: Number(plain.rating_count || 0),
      releaseDate,
    };

    if (!passedSet) return challengeData;
    const lock = evaluateProgressionLockForChallenge(plain, plainAll, passedSet);
    return { ...challengeData, ...lock };
  });
}

/** Admin / Exam Bank: visible challenges including inactive (archived), with attempt counts */
async function listChallengesAdmin(filters = {}) {
  const vis = await buildChallengeVisibilityWhere(filters.viewer, {
    filterOrgId: filters.filterOrgId || null,
    filterDeptId: filters.filterDeptId || null,
    filterUnitId: filters.filterUnitId || null,
  });
  const where = { ...vis };
  if (filters.category) where.category = filters.category;
  if (filters.difficulty) where.difficulty = filters.difficulty;

  const attemptCountSql = sequelize.literal(
    `(SELECT COUNT(*)::int FROM "GamificationAttempts" AS ga WHERE ga.challenge_id = "LearningChallenge"."id")`
  );

  const rows = await LearningChallenge.findAll({
    where,
    attributes: {
      include: [[attemptCountSql, "attempt_count"]],
    },
    order: [["updatedAt", "DESC"]],
  });

  return rows.map((row) => {
    const plain = row.get({ plain: true });
    const base = toFrontendChallenge(row);
    return {
      ...base,
      orgId: plain.org_id != null ? plain.org_id : null,
      deptId: plain.dept_id != null ? plain.dept_id : null,
      unitId: plain.unit_id != null ? plain.unit_id : null,
      isActive: plain.is_active !== false,
      attemptCount: Number(row.get("attempt_count") ?? 0),
      updatedAt: plain.updatedAt ? new Date(plain.updatedAt).toISOString() : null,
    };
  });
}

async function getChallengeById(id, viewer) {
  const row = await LearningChallenge.findByPk(id);
  if (!row || !row.is_active) throw new AppError("Challenge not found", 404);
  if (viewer && !userCanAccessChallenge(viewer, row)) throw new AppError("Forbidden", 403);
  const base = toFrontendChallenge(row);
  const uid = viewer?.user_id;
  if (!uid) return base;
  const plainAll = await loadVisibleChallengePlains(viewer, null, null);
  const passedSet = await getPassedChallengeIdSet(uid);
  const lock = evaluateProgressionLockForChallenge(row.get({ plain: true }), plainAll, passedSet);
  return { ...base, ...lock };
}

async function completeChallenge(userId, challengeId, body) {
  const { score = 0, passed = false, timeSpentSec = 0, stepAnswers = null } = body;
  const effectivePassed = normalizePassed(score, passed);
  const challenge = await LearningChallenge.findByPk(challengeId);
  if (!challenge || !challenge.is_active) throw new AppError("Challenge not found", 404);

  const user = await User.findByPk(userId);
  if (!user) throw new AppError("User not found", 404);
  if (!userCanAccessChallenge(user, challenge)) throw new AppError("Forbidden", 403);

  const plainAll = await loadVisibleChallengePlains(user, null, null);
  const passedSet = await getPassedChallengeIdSet(userId);
  const lock = evaluateProgressionLockForChallenge(challenge.get({ plain: true }), plainAll, passedSet);
  if (lock.progressionLocked) {
    throw new AppError(lock.progressionLockReason || "This challenge is locked.", 403);
  }

  const t = await sequelize.transaction();
  try {
    const attempt = await GamificationAttempt.create(
      {
        user_id: userId,
        challenge_id: challengeId,
        score,
        passed: effectivePassed,
        time_spent_sec: timeSpentSec,
        started_at: new Date(),
        completed_at: new Date(),
        step_answers: stepAnswers,
      },
      { transaction: t }
    );

    if (effectivePassed) {
      const xpGain = challenge.xp_reward || 0;
      const repGain = challenge.reputation_reward || 0;
      const newXp = (user.gamification_xp || 0) + xpGain;
      const newRep = (user.gamification_reputation || 0) + repGain;
      const { level, xpToNext } = computeLevel(newXp);
      const { streak, longest, lastActivity } = streakUpdate(user, new Date());

      await user.update(
        {
          gamification_xp: newXp,
          gamification_level: level,
          gamification_xp_to_next: xpToNext,
          gamification_reputation: newRep,
          gamification_streak: streak,
          gamification_longest_streak: longest,
          gamification_last_activity: lastActivity,
        },
        { transaction: t }
      );
    }

    await user.reload({ transaction: t });
    const achievementsUnlocked = await recomputeAchievements(userId, user, t);

    await t.commit();

    return {
      attempt,
      user: {
        gamification_xp: user.gamification_xp,
        gamification_level: user.gamification_level,
        gamification_xp_to_next: user.gamification_xp_to_next,
        gamification_reputation: user.gamification_reputation,
        gamification_streak: user.gamification_streak,
        gamification_longest_streak: user.gamification_longest_streak,
        gamification_last_activity: user.gamification_last_activity,
      },
      achievementsUnlocked: achievementsUnlocked.map((d) => ({
        id: d.id,
        title: d.title,
        description: d.description,
        icon: d.icon,
      })),
    };
  } catch (e) {
    await t.rollback();
    throw e;
  }
}

async function getProgressMe(userId) {
  const user = await User.findByPk(userId);
  if (!user) throw new AppError("User not found", 404);
  const attempts = await GamificationAttempt.findAll({
    where: { user_id: userId },
    order: [["completed_at", "DESC"]],
    limit: 100,
    include: [{ model: LearningChallenge, as: "challenge", required: false }],
  });

  const attemptsJson = attempts.map((a) => {
    const j = a.toJSON();
    const ch = j.challenge;
    return {
      id: j.id,
      userId: j.user_id,
      challengeId: j.challenge_id,
      score: j.score,
      passed: j.passed,
      timeSpent: j.time_spent_sec,
      startedAt: j.started_at,
      completedAt: j.completed_at,
      stepAnswers: j.step_answers,
      challenge: ch ? toFrontendChallenge(ch) : null,
    };
  });

  return {
    user: {
      gamification_xp: user.gamification_xp,
      gamification_level: user.gamification_level,
      gamification_xp_to_next: user.gamification_xp_to_next,
      gamification_reputation: user.gamification_reputation,
      gamification_streak: user.gamification_streak,
      gamification_longest_streak: user.gamification_longest_streak,
      gamification_last_activity: user.gamification_last_activity,
    },
    attempts: attemptsJson,
  };
}

async function getAchievementsForUser(userId) {
  await ensureUserAchievementRows(userId);
  const defs = await GamificationAchievement.findAll({ order: [["id", "ASC"]] });
  const rows = await UserGamificationAchievement.findAll({
    where: { user_id: userId },
  });
  const byId = new Map(rows.map((r) => [r.achievement_id, r]));
  return defs.map((d) => {
    const r = byId.get(d.id);
    const completed = r ? r.completed : false;
    const completedAt = r?.completed_at
      ? new Date(r.completed_at).toISOString()
      : null;
    return {
      id: d.id,
      title: d.title,
      description: d.description,
      icon: d.icon,
      progress: r ? r.progress : 0,
      total: d.target_count,
      completed,
      completedAt,
    };
  });
}

function normalizeLeaderboardScope(raw) {
  const s = (raw || "org").toString().toLowerCase();
  if (s === "global") return "global";
  if (s === "dept_compare") return "dept_compare";
  if (s === "branch_compare" || s === "unit_compare") return "branch_compare";
  if (s === "branch_compare_top") return "branch_compare_top";
  if (s === "dept" || s === "department") return "dept";
  if (s === "unit" || s === "branch") return "unit";
  if (s === "unit_subtree") return "unit_subtree";
  if (s === "org" || s === "organization") return "org";
  return "org";
}

async function getLeaderboard({ scope, orgId, deptId, unitId, limit = 50, offset = 0, requester }) {
  const sc = normalizeLeaderboardScope(scope);
  const where = { status: "ACTIVE" };

  if (sc === "branch_compare" || sc === "dept_compare" || sc === "branch_compare_top") {
    const oid = orgId || requester?.org_id;
    if (!oid) throw new AppError("Aggregated scope requires org_id", 400);
    if (requester.user_type !== "SUPERADMIN" && requester.org_id !== oid) {
      throw new AppError("Forbidden", 403);
    }

    const groupByField = (sc === "branch_compare" || sc === "branch_compare_top") ? "unit_id" : "dept_id";
    const modelToInclude = (sc === "branch_compare" || sc === "branch_compare_top") ? OrganizationalUnit : Department;
    const includeAs = (sc === "branch_compare" || sc === "branch_compare_top") ? "OrganizationalUnit" : "Department";

    const groupWhere = { ...where, org_id: oid, [groupByField]: { [Op.ne]: null } };
    
    // For branch_compare_top, we only want units that have NO parent (Level 1)
    if (sc === "branch_compare_top") {
      const topUnits = await OrganizationalUnit.findAll({
        where: { org_id: oid, parent_id: null },
        attributes: ["id"]
      });
      const topIds = topUnits.map(u => u.id);
      groupWhere.unit_id = { [Op.in]: topIds };
    }

    const aggregated = await User.findAll({
      where: groupWhere,
      attributes: [
        groupByField,
        [sequelize.fn("SUM", sequelize.col("gamification_xp")), "total_xp"],
        [sequelize.fn("COUNT", sequelize.col("user_id")), "user_count"],
      ],
      include: [{ model: modelToInclude, attributes: ["id", "name"], required: true }],
      group: [groupByField, `${includeAs}.id`],
      order: [[sequelize.literal("total_xp"), "DESC"]],
      limit: Math.min(Number(limit) || 50, 200),
      offset: Number(offset) || 0,
    });

    return aggregated.map((row, i) => {
      const data = row.get({ plain: true });
      const entity = data[includeAs];
      return {
        rank: Number(offset) + i + 1,
        id: data[groupByField],
        name: entity ? entity.name : "Unknown",
        xp: Number(data.total_xp || 0),
        userCount: Number(data.user_count || 0),
        isGroup: true,
        type: (sc === "branch_compare" || sc === "branch_compare_top") ? "branch" : "dept",
      };
    });
  }

  if (sc === "global") {
    // Global scope is now available to all authenticated users
  } else if (sc === "org") {
    const oid = orgId || requester?.org_id;
    if (!oid) throw new AppError("Organization scope requires org_id", 400);
    if (requester.user_type !== "SUPERADMIN" && requester.org_id !== oid) {
      throw new AppError("Forbidden", 403);
    }
    where.org_id = oid;
  } else if (sc === "unit" || sc === "unit_subtree") {
    const oid = orgId || requester?.org_id;
    const uid = unitId || requester?.unit_id;
    if (!oid || !uid) throw new AppError("Unit scope requires org_id and unit_id", 400);
    
    if (requester.user_type !== "SUPERADMIN") {
      if (requester.org_id !== oid) throw new AppError("Forbidden", 403);
      
      // If UNIT_ADMIN, they can see their own subtree. 
      // If they are not UNIT_ADMIN/ORG_ADMIN, they can only see their own branch.
      const isAuthorized = requester.user_type === "ORG_ADMIN" || 
                           (requester.user_type === "UNIT_ADMIN" && await unitService.isDescendantOf(uid, requester.unit_id, oid)) ||
                           (requester.unit_id === uid);
                           
      if (!isAuthorized) throw new AppError("Forbidden", 403);
    }
    
    where.org_id = oid;
    if (sc === "unit_subtree") {
      const subtreeIds = await unitService.getSubtreeIds(uid, oid);
      where.unit_id = { [Op.in]: subtreeIds };
    } else {
      where.unit_id = uid;
    }
  } else {
    const oid = orgId || requester?.org_id;
    const did = deptId || requester?.dept_id;
    if (!oid || !did) throw new AppError("Department scope requires org_id and dept_id", 400);
    const dep = await Department.findByPk(did);
    if (!dep || dep.org_id !== oid) throw new AppError("Invalid department", 400);
    if (requester.user_type === "SUPERADMIN") {
      /* ok */
    } else if (requester.user_type === "ORG_ADMIN" || requester.user_type === "UNIT_ADMIN") {
      if (requester.org_id !== oid) throw new AppError("Forbidden", 403);
    } else if (requester.user_type === "DEPT_ADMIN" || requester.user_type === "STAFF") {
      if (requester.org_id !== oid || requester.dept_id !== did) throw new AppError("Forbidden", 403);
    } else {
      throw new AppError("Forbidden", 403);
    }
    where.org_id = oid;
    where.dept_id = did;
  }

  const passedChallengeCount = sequelize.literal(
    `(SELECT COUNT(DISTINCT "challenge_id")::int FROM "GamificationAttempts" AS "ga" WHERE "ga"."user_id" = "User"."user_id" AND "ga"."completed_at" IS NOT NULL AND ("ga"."passed" = true OR "ga"."score" >= ${PASS_SCORE_PERCENT}))`
  );
  
  // Get total count for pagination metadata if needed, but for now we just return the rows.
  // Actually, let's just return the rows and handle page state in frontend.
  
  const users = await User.findAll({
    where,
    attributes: [
      "user_id",
      "first_name",
      "last_name",
      "gamification_xp",
      "gamification_level",
      "gamification_reputation",
      "gamification_streak",
      "org_id",
      "dept_id",
      [passedChallengeCount, "passed_challenge_count"],
    ],
    include: [
      { model: Department, attributes: ["id", "name"], required: false },
      { model: Organization, attributes: ["id", "name"], required: false },
    ],
    order: [["gamification_xp", "DESC"]],
    limit: Math.min(Number(limit) || 50, 200),
    offset: Number(offset) || 0,
  });
  
  return users.map((u, i) => {
    const dep = u.Department;
    const org = u.Organization;
    const currentOffset = Number(offset) || 0;
    return {
      rank: currentOffset + i + 1,
      userId: u.user_id,
      name: `${u.first_name} ${u.last_name}`,
      xp: u.gamification_xp,
      level: u.gamification_level,
      reputation: u.gamification_reputation,
      orgId: u.org_id,
      organizationName: org ? org.name : null,
      departmentId: u.dept_id,
      departmentName: dep ? dep.name : null,
      streak: u.gamification_streak || 0,
      challengesCompleted: Number(u.get("passed_challenge_count") ?? 0),
    };
  });
}

async function upsertChallenge(data, isUpdate = false, author = null) {
  const id = data.id;
  if (!id) throw new AppError("id is required", 400);

  let existingRow = null;
  let base = { ...data, id };
  if (isUpdate) {
    existingRow = await LearningChallenge.findByPk(id);
    if (!existingRow) throw new AppError("Challenge not found", 404);
    base = { ...existingRow.get({ plain: true }), ...data, id };
  }

  const deptRaw = base.dept_id != null ? base.dept_id : base.deptId;
  const orgRaw = base.org_id != null ? base.org_id : base.orgId;
  const unitRaw = base.unit_id != null ? base.unit_id : base.unitId;
  const payload = {
    id,
    org_id: orgRaw != null ? orgRaw : null,
    dept_id: deptRaw != null ? deptRaw : null,
    unit_id: unitRaw != null ? unitRaw : null,
    title: base.title,
    description: base.description != null ? base.description : "",
    type: base.type,
    category: base.category,
    difficulty: base.difficulty,
    duration: base.duration ?? 0,
    xp_reward: base.xpReward ?? base.xp_reward ?? 0,
    reputation_reward: base.reputationReward ?? base.reputation_reward ?? 0,
    steps: base.steps || [],
    is_active: base.is_active !== false,
  };

  if (author) await assertAuthorCanUpsertChallenge(author, payload, existingRow);

  validateGamificationSteps(payload.steps);

  if (isUpdate && existingRow) {
    await existingRow.update(payload);
    return toFrontendChallenge(existingRow);
  }
  await LearningChallenge.upsert(payload);
  return toFrontendChallenge(await LearningChallenge.findByPk(id));
}

async function deleteChallenge(id, author = null) {
  const row = await LearningChallenge.findByPk(id);
  if (!row) throw new AppError("Challenge not found", 404);
  if (author) await assertAuthorCanMutateExistingChallenge(author, row);
  await row.update({ is_active: false });
  return { success: true };
}

async function assertSnapshotAllowed(requester, enumScope, orgId, deptId) {
  const ut = requester.user_type;
  if (ut === "SUPERADMIN") return;
  if (enumScope === "GLOBAL") throw new AppError("Forbidden", 403);
  if (ut === "ORG_ADMIN") {
    if (!orgId || orgId !== requester.org_id) throw new AppError("Forbidden", 403);
    if (enumScope === "DEPT" && deptId) {
      const d = await Department.findByPk(deptId);
      if (!d || d.org_id !== requester.org_id) throw new AppError("Forbidden", 403);
    }
    return;
  }
  if (ut === "DEPT_ADMIN") {
    if (enumScope !== "DEPT" || !deptId || deptId !== requester.dept_id || orgId !== requester.org_id) {
      throw new AppError("Forbidden", 403);
    }
    return;
  }
  throw new AppError("Forbidden", 403);
}

async function createLeaderboardSnapshot(requester, { scope, org_id, dept_id }) {
  const sc = normalizeLeaderboardScope(scope);
  let enumScope = "ORG";
  if (sc === "global") enumScope = "GLOBAL";
  if (sc === "dept") enumScope = "DEPT";

  const orgId = org_id || (sc !== "global" ? requester.org_id : null);
  const deptId = dept_id || (sc === "dept" ? requester.dept_id : null);

  await assertSnapshotAllowed(requester, enumScope, orgId, deptId);

  const rows = await getLeaderboard({
    scope: sc,
    orgId,
    deptId,
    limit: 200,
    requester,
  });

  const snap = await LeaderboardSnapshot.create({
    scope: enumScope,
    org_id: enumScope === "GLOBAL" ? null : orgId,
    dept_id: enumScope === "DEPT" ? deptId : null,
    period: "MANUAL",
    payload: rows,
    created_by_user_id: requester.user_id,
  });

  return { snapshot: snap };
}

function formatTrainingAssignment(row) {
  const plain = row.toJSON ? row.toJSON() : row;
  let due = plain.due_date;
  if (due && typeof due !== "string") {
    due = due.toISOString ? due.toISOString().slice(0, 10) : String(due);
  }
  return {
    id: plain.id,
    campaignId: plain.id,
    userId: plain.assign_all ? "all" : plain.user_id,
    challengeId: plain.challenge_id,
    orgId: plain.org_id,
    deptId: plain.dept_id,
    unitId: plain.unit_id,
    title: plain.title,
    dueDate: due,
  };
}

function dueDateEndUtc(due) {
  let s = due;
  if (due && typeof due !== "string") {
    s = due.toISOString ? due.toISOString().slice(0, 10) : String(due);
  }
  return new Date(`${s}T23:59:59.999Z`);
}

/**
 * Completion = passing attempt (score ≥ threshold or passed flag) with completed_at on/before assignment due date.
 */
async function getAssignmentCompletionStats(plain) {
  const challengeId = plain.challenge_id;
  const dueEnd = dueDateEndUtc(plain.due_date);
  const assignAll = plain.assign_all;
  const orgId = plain.org_id;
  const userId = plain.user_id;

  if (!assignAll && userId) {
    const hit = await GamificationAttempt.findOne({
      where: {
        user_id: userId,
        challenge_id: challengeId,
        completed_at: { [Op.ne]: null, [Op.lte]: dueEnd },
        [Op.or]: [{ passed: true }, { score: { [Op.gte]: PASS_SCORE_PERCENT } }],
      },
    });
    return {
      audienceTotal: 1,
      completedCount: hit ? 1 : 0,
      completionPercent: hit ? 100 : 0,
    };
  }

  if (assignAll) {
    const audienceWhere = { status: "ACTIVE" };
    if (plain.unit_id) audienceWhere.unit_id = plain.unit_id;
    else if (plain.dept_id) audienceWhere.dept_id = plain.dept_id;
    else if (plain.org_id) audienceWhere.org_id = plain.org_id;

    const audienceTotal = await User.count({ where: audienceWhere });
    
    let scopeJoinSql = "";
    let scopeWhereSql = "u.status = 'ACTIVE'";
    const replacements = { challengeId, dueEnd, passScore: PASS_SCORE_PERCENT };

    if (plain.unit_id) {
      scopeWhereSql += " AND u.unit_id = :unitId";
      replacements.unitId = plain.unit_id;
    } else if (plain.dept_id) {
      scopeWhereSql += " AND u.dept_id = :deptId";
      replacements.deptId = plain.dept_id;
    } else if (plain.org_id) {
      scopeWhereSql += " AND u.org_id = :orgId";
      replacements.orgId = plain.org_id;
    }

    const rows = await sequelize.query(
      `SELECT COUNT(DISTINCT ga.user_id)::int AS c
       FROM "GamificationAttempts" ga
       INNER JOIN "Users" u ON u.user_id = ga.user_id
       WHERE ${scopeWhereSql}
         AND ga.challenge_id = :challengeId
         AND ga.completed_at IS NOT NULL
         AND ga.completed_at <= :dueEnd
         AND (ga.passed = true OR ga.score >= :passScore)`,
      {
        replacements,
        type: QueryTypes.SELECT,
      }
    );
    const completedCount = rows[0]?.c ?? 0;
    const completionPercent =
      audienceTotal > 0 ? Math.min(100, Math.round((completedCount / audienceTotal) * 100)) : 0;
    return { audienceTotal, completedCount, completionPercent };
  }

  const rows = await sequelize.query(
    `SELECT COUNT(DISTINCT ga.user_id)::int AS c
     FROM "GamificationAttempts" ga
     WHERE ga.challenge_id = :challengeId
       AND ga.completed_at IS NOT NULL
       AND ga.completed_at <= :dueEnd
       AND (ga.passed = true OR ga.score >= :passScore)`,
    {
      replacements: {
        challengeId,
        dueEnd,
        passScore: PASS_SCORE_PERCENT,
      },
      type: QueryTypes.SELECT,
    }
  );
  const completedCount = rows[0]?.c ?? 0;
  return {
    audienceTotal: null,
    completedCount,
    completionPercent: null,
  };
}

async function listMyTrainingAssignments(viewer) {
  const uid = viewer.user_id;
  const orgId = viewer.org_id;
  const ut = viewer.user_type;

  const or = [{ user_id: uid }];

  if (ut === "SUPERADMIN") {
    or.push({ assign_all: true, org_id: null });
    if (orgId) {
      or.push({ assign_all: true, org_id: orgId });
    }
  } else if (orgId) {
    or.push({ assign_all: true, org_id: orgId, dept_id: null, unit_id: null });
    if (viewer.dept_id) {
      or.push({ assign_all: true, org_id: orgId, dept_id: viewer.dept_id });
    }
    if (viewer.unit_id) {
      or.push({ assign_all: true, org_id: orgId, unit_id: viewer.unit_id });
    }
  }

  const rows = await LearnerTrainingAssignment.findAll({
    where: { [Op.or]: or },
    order: [["due_date", "ASC"]],
  });

  return rows.map(formatTrainingAssignment);
}

async function createTrainingAssignment(actor, body) {
  const challenge_id = body.challenge_id;
  const title = body.title;
  const due_date = body.due_date;
  const assign_all = !!body.assign_all;
  const user_id = body.user_id || null;
  let org_id = body.org_id === "" ? null : body.org_id || null;

  if (!challenge_id || !title || !due_date) {
    throw new AppError("challenge_id, title, and due_date are required", 400);
  }
  if (!assign_all && !user_id) {
    throw new AppError("Set assign_all true for org-wide, or provide user_id for one learner", 400);
  }
  if (assign_all && user_id) {
    throw new AppError("Use either assign_all or user_id, not both", 400);
  }

  const ch = await LearningChallenge.findByPk(challenge_id);
  if (!ch || !ch.is_active) throw new AppError("Challenge not found", 404);

  if (actor.user_type === "ORG_ADMIN") {
    if (!actor.org_id) throw new AppError("Forbidden", 403);
    org_id = actor.org_id;
    // Scoped to body params if provided, otherwise whole org
    if (body.unit_id) org_id = actor.org_id; 
    if (user_id) {
      const target = await User.findByPk(user_id);
      if (!target || String(target.org_id) !== String(actor.org_id)) {
        throw new AppError("User is not in your organization", 403);
      }
    }
  } else if (actor.user_type === "DEPT_ADMIN") {
    org_id = actor.org_id;
    body.dept_id = actor.dept_id;
    body.unit_id = null;
  } else if (actor.user_type === "UNIT_ADMIN") {
    org_id = actor.org_id;
    body.unit_id = actor.unit_id;
    body.dept_id = null;
  } else if (actor.user_type === "SUPERADMIN") {
    // org_id from body or null
  } else {
    throw new AppError("Forbidden", 403);
  }

  const dept_id = body.dept_id || null;
  const unit_id = body.unit_id || null;

  if (assign_all && !org_id && actor.user_type !== "SUPERADMIN") {
    throw new AppError("org_id is required for organization-wide assignments", 400);
  }

  let resolvedOrgId = org_id;
  if (!assign_all && user_id) {
    const target = await User.findByPk(user_id);
    if (!target) throw new AppError("User not found", 404);
    resolvedOrgId = target.org_id;
  }

  const row = await LearnerTrainingAssignment.create({
    org_id: assign_all ? org_id : resolvedOrgId,
    dept_id: assign_all ? dept_id : null,
    unit_id: assign_all ? unit_id : null,
    user_id: assign_all ? null : user_id,
    assign_all,
    challenge_id,
    title: String(title).slice(0, 255),
    due_date,
  });

  return formatTrainingAssignment(row);
}

async function listTrainingAssignmentsForAdmin(actor, query = {}) {
  const orgIdFilter = query.org_id === "" ? null : query.org_id || null;
  const where = {};

  if (actor.user_type === "ORG_ADMIN") {
    if (!actor.org_id) throw new AppError("Forbidden", 403);
    where.org_id = actor.org_id;
    if (query.dept_id) where.dept_id = query.dept_id;
    if (query.unit_id) where.unit_id = query.unit_id;
  } else if (actor.user_type === "DEPT_ADMIN") {
    where.org_id = actor.org_id;
    where.dept_id = actor.dept_id;
  } else if (actor.user_type === "UNIT_ADMIN") {
    where.org_id = actor.org_id;
    where.unit_id = actor.unit_id;
  } else if (actor.user_type === "SUPERADMIN") {
    if (orgIdFilter) where.org_id = orgIdFilter;
    if (query.dept_id) where.dept_id = query.dept_id;
    if (query.unit_id) where.unit_id = query.unit_id;
  } else {
    throw new AppError("Forbidden", 403);
  }

  const rows = await LearnerTrainingAssignment.findAll({
    where,
    order: [["due_date", "ASC"]],
  });

  const enriched = await Promise.all(
    rows.map(async (row) => {
      const plain = row.get({ plain: true });
      const base = formatTrainingAssignment(row);
      const stats = await getAssignmentCompletionStats(plain);
      return { ...base, ...stats };
    })
  );
  return enriched;
}

async function deleteTrainingAssignment(actor, id) {
  if (!id) throw new AppError("Assignment id required", 400);
  const row = await LearnerTrainingAssignment.findByPk(id);
  if (!row) throw new AppError("Assignment not found", 404);

  if (actor.user_type === "ORG_ADMIN") {
    if (!actor.org_id || String(row.org_id) !== String(actor.org_id)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (actor.user_type === "DEPT_ADMIN") {
    if (String(row.dept_id) !== String(actor.dept_id)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (actor.user_type === "UNIT_ADMIN") {
    if (String(row.unit_id) !== String(actor.unit_id)) {
      throw new AppError("Forbidden", 403);
    }
  } else if (actor.user_type !== "SUPERADMIN") {
    throw new AppError("Forbidden", 403);
  }

  await row.destroy();
  return { success: true };
}

function firstQueryVal(raw) {
  if (raw === undefined || raw === null || raw === "") return null;
  return Array.isArray(raw) ? raw[0] : raw;
}

/**
 * Resolves org/dept/unit for admin training analytics (aligned with GET /users roster scope).
 */
function resolveAdminTrainingScope(viewer, query = {}) {
  const ut = viewer.user_type;
  let org_id = firstQueryVal(query.org_id);
  let dept_id = firstQueryVal(query.dept_id);
  let unit_id = firstQueryVal(query.unit_id);

  if (ut === "ORG_ADMIN") {
    org_id = viewer.org_id;
    dept_id = null;
    unit_id = null;
  } else if (ut === "DEPT_ADMIN") {
    org_id = viewer.org_id;
    dept_id = viewer.dept_id;
    unit_id = null;
  } else if (ut === "UNIT_ADMIN") {
    org_id = viewer.org_id;
    unit_id = viewer.unit_id;
    dept_id = null;
  }

  if (dept_id && !org_id) {
    throw new AppError("org_id is required when dept_id is set", 400);
  }
  if (unit_id && !org_id) {
    throw new AppError("org_id is required when unit_id is set", 400);
  }
  if (ut === "UNIT_ADMIN" && !viewer.unit_id) {
    throw new AppError("Unit administrators must have a unit assigned", 403);
  }
  if (ut !== "SUPERADMIN" && !org_id) {
    throw new AppError("Organization context required", 403);
  }

  const userWhere = {};
  if (org_id) userWhere.org_id = org_id;
  if (dept_id) userWhere.dept_id = dept_id;
  if (unit_id) userWhere.unit_id = unit_id;

  const scopeParts = [];
  const sqlRepl = { passScore: PASS_SCORE_PERCENT };
  if (org_id) {
    scopeParts.push("u.org_id = :orgId");
    sqlRepl.orgId = org_id;
  }
  if (dept_id) {
    scopeParts.push("u.dept_id = :deptId");
    sqlRepl.deptId = dept_id;
  }
  if (unit_id) {
    scopeParts.push("u.unit_id = :unitId");
    sqlRepl.unitId = unit_id;
  }
  const scopeSql = scopeParts.length ? scopeParts.join(" AND ") : "TRUE";

  let scopeLabel = "All tenants";
  if (unit_id) scopeLabel = "Unit scope";
  else if (dept_id) scopeLabel = "Department scope";
  else if (org_id) scopeLabel = "Organization scope";
  if (ut === "SUPERADMIN" && !org_id) scopeLabel = "All tenants (superadmin)";

  return { org_id, dept_id, unit_id, userWhere, scopeSql, sqlRepl, scopeLabel };
}

async function getAdminTrainingSummary(viewer, query = {}) {
  const { org_id, dept_id, unit_id, userWhere, scopeSql, sqlRepl, scopeLabel } = resolveAdminTrainingScope(
    viewer,
    query
  );

  const userCount = await User.count({ where: userWhere });
  const activeUserCount = await User.count({
    where: { ...userWhere, status: "ACTIVE" },
  });

  const catSql = `
    SELECT lc.category AS category,
      COUNT(DISTINCT ga.user_id)::int AS users_with_pass,
      COUNT(*)::int AS pass_attempts
    FROM "GamificationAttempts" ga
    INNER JOIN "Users" u ON u.user_id = ga.user_id
    INNER JOIN "LearningChallenges" lc ON lc.id = ga.challenge_id
    WHERE ga.completed_at IS NOT NULL
      AND (ga.passed = true OR ga.score >= :passScore)
      AND (${scopeSql})
    GROUP BY lc.category
    ORDER BY users_with_pass DESC, lc.category ASC
  `;

  const categoryRows = await sequelize.query(catSql, {
    replacements: sqlRepl,
    type: QueryTypes.SELECT,
  });

  const topSql = `
    SELECT u.user_id AS user_id,
      u.first_name AS first_name,
      u.last_name AS last_name,
      u.gamification_xp AS gamification_xp,
      u.gamification_streak AS gamification_streak,
      (
        SELECT COUNT(DISTINCT ga.challenge_id)::int
        FROM "GamificationAttempts" ga
        WHERE ga.user_id = u.user_id
          AND ga.completed_at IS NOT NULL
          AND (ga.passed = true OR ga.score >= :passScore)
      ) AS challenges_passed
    FROM "Users" u
    WHERE (${scopeSql})
    ORDER BY challenges_passed DESC, u.gamification_xp DESC NULLS LAST
    LIMIT 10
  `;

  const topRows = await sequelize.query(topSql, {
    replacements: sqlRepl,
    type: QueryTypes.SELECT,
  });

  const topChallengers = topRows.map((r, i) => ({
    rank: i + 1,
    userId: r.user_id,
    name: `${r.first_name || ""} ${r.last_name || ""}`.trim() || "—",
    xp: Number(r.gamification_xp) || 0,
    streak: Number(r.gamification_streak) || 0,
    challengesCompleted: Number(r.challenges_passed) || 0,
  }));

  const categories = categoryRows.map((r) => ({
    category: r.category,
    usersWithPass: Number(r.users_with_pass) || 0,
    passAttempts: Number(r.pass_attempts) || 0,
  }));

  return {
    scopeLabel,
    orgId: org_id,
    deptId: dept_id,
    unitId: unit_id,
    userCount,
    activeUserCount,
    categories,
    topChallengers,
  };
}

async function listLeaderboardSnapshots(requester, { limit = 20, scope, org_id, dept_id } = {}) {
  const where = {};
  if (scope) where.scope = scope;
  if (requester.user_type === "ORG_ADMIN") {
    where.org_id = requester.org_id;
  } else if (requester.user_type === "DEPT_ADMIN") {
    where.scope = "DEPT";
    where.dept_id = requester.dept_id;
    where.org_id = requester.org_id;
  } else if (requester.user_type !== "SUPERADMIN") {
    throw new AppError("Forbidden", 403);
  }
  if (requester.user_type === "SUPERADMIN") {
    if (org_id) where.org_id = org_id;
    if (dept_id) where.dept_id = dept_id;
  }
  const rows = await LeaderboardSnapshot.findAll({
    where,
    order: [["captured_at", "DESC"]],
    limit: Math.min(Number(limit) || 20, 100),
  });
  return rows.map((r) => ({
    id: r.id,
    capturedAt: r.captured_at,
    scope: r.scope,
    orgId: r.org_id,
    deptId: r.dept_id,
    period: r.period,
    payload: r.payload,
    createdByUserId: r.created_by_user_id,
  }));
}

async function listCategories() {
  const cats = await LearningChallengeCategory.findAll({
    order: [["name", "ASC"]],
  });
  return cats.map(c => c.get({ plain: true }));
}

async function createCategory(data) {
  const { name, display_name, image_url, description } = data;
  if (!name || !display_name) throw new AppError("Name and display name are required", 400);
  return await LearningChallengeCategory.create({ name, display_name, image_url, description });
}

async function updateCategory(id, data) {
  const cat = await LearningChallengeCategory.findByPk(id);
  if (!cat) throw new AppError("Category not found", 404);
  const { name, display_name, image_url, description } = data;
  if (name) cat.name = name;
  if (display_name) cat.display_name = display_name;
  if (image_url !== undefined) cat.image_url = image_url;
  if (description !== undefined) cat.description = description;
  await cat.save();
  return cat;
}

async function deleteCategory(id) {
  const cat = await LearningChallengeCategory.findByPk(id);
  if (!cat) throw new AppError("Category not found", 404);
  await cat.destroy();
  return true;
}

async function rateChallenge(userId, challengeId, ratingData) {
  const { rating, review_text } = ratingData;
  if (!rating || rating < 1 || rating > 5) {
    throw new AppError("Rating must be between 1 and 5", 400);
  }

  const challenge = await LearningChallenge.findByPk(challengeId);
  if (!challenge || !challenge.is_active) throw new AppError("Challenge not found", 404);

  // Check if user has passed (allow a small margin or log failure)
  const passedSet = await getPassedChallengeIdSet(userId);
  if (!passedSet.has(challengeId)) {
    console.warn(`User ${userId} tried to rate challenge ${challengeId} but 'passed' record not found yet.`);
    // We'll allow it anyway for better UX, but log the warning
  }

  console.log(`Rating challenge ${challengeId} by user ${userId}: ${rating} stars`);
  
  const [record, created] = await GamificationRating.upsert({
    user_id: userId,
    challenge_id: challengeId,
    rating,
    review_text: review_text || null,
  });

  console.log(`Rating ${created ? 'created' : 'updated'} for challenge ${challengeId}`);
  return record;
}

module.exports = {
  toFrontendChallenge,
  computeLevel,
  listChallenges,
  listChallengesAdmin,
  getChallengeById,
  completeChallenge,
  getProgressMe,
  getAchievementsForUser,
  getLeaderboard,
  normalizeLeaderboardScope,
  getAdminTrainingSummary,
  listCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  rateChallenge,
  upsertChallenge,
  deleteChallenge,
  createLeaderboardSnapshot,
  listLeaderboardSnapshots,
  listMyTrainingAssignments,
  createTrainingAssignment,
  listTrainingAssignmentsForAdmin,
  deleteTrainingAssignment,
};
