const { Op } = require("sequelize");
const { GamificationAttempt } = require("../models");
const {
  attemptRowCountsAsPassed,
  difficultyTier,
  categoryDisplayLabel,
} = require("../constants/challengeProgression");

/**
 * Challenge unlock rules (per category, among challenges visible to the user):
 * - Beginner: available (if visible).
 * - Intermediate: locked until every visible beginner in the same category is mastered.
 * - Advanced: locked until every visible intermediate in the same category is mastered.
 * - If there is no challenge at the lower tier in that category, the next tier is not blocked.
 * - A challenge the user already mastered stays unlocked for replay.
 * "Mastered" = passed flag or score ≥ PASS threshold on a completed attempt.
 */

/**
 * Distinct challenge IDs the user has "mastered" (passed flag or score ≥ threshold).
 */
async function getPassedChallengeIdSet(userId, { transaction } = {}) {
  const attempts = await GamificationAttempt.findAll({
    where: {
      user_id: userId,
      completed_at: { [Op.ne]: null },
    },
    attributes: ["challenge_id", "score", "passed"],
    transaction,
  });
  const set = new Set();
  for (const a of attempts) {
    const plain = a.get ? a.get({ plain: true }) : a;
    if (attemptRowCountsAsPassed(plain)) set.add(plain.challenge_id);
  }
  return set;
}

function evaluateProgressionLockForChallenge(challengePlain, allVisiblePlain, passedIdSet) {
  if (passedIdSet.has(challengePlain.id)) {
    return { progressionLocked: false, progressionLockReason: null };
  }
  const tier = difficultyTier(challengePlain.difficulty);
  if (tier <= 0) {
    return { progressionLocked: false, progressionLockReason: null };
  }
  const requiredTier = tier - 1;
  const requiredLabel = requiredTier === 0 ? "beginner" : "intermediate";
  const cat = challengePlain.category;
  const prerequisites = allVisiblePlain.filter(
    (c) => c.category === cat && difficultyTier(c.difficulty) === requiredTier,
  );
  if (prerequisites.length === 0) {
    return { progressionLocked: false, progressionLockReason: null };
  }
  const done = prerequisites.filter((c) => passedIdSet.has(c.id)).length;
  const total = prerequisites.length;
  if (done >= total) {
    return { progressionLocked: false, progressionLockReason: null };
  }
  const catLabel = categoryDisplayLabel(cat);
  const reason = `Complete all ${requiredLabel} challenges in the ${catLabel} category first (${done}/${total} done).`;
  return { progressionLocked: true, progressionLockReason: reason };
}

module.exports = {
  getPassedChallengeIdSet,
  evaluateProgressionLockForChallenge,
};
