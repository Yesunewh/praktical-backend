/** Align with learner pass rule (frontend `CHALLENGE_PASS_SCORE_PERCENT`). */
const PASS_SCORE_PERCENT = 70;

function normalizePassed(score, passed) {
  const s = Number(score) || 0;
  return Boolean(passed) || s >= PASS_SCORE_PERCENT;
}

function attemptRowCountsAsPassed(row) {
  if (!row || !row.completed_at) return false;
  return normalizePassed(row.score, row.passed);
}

/** 0 = beginner, 1 = intermediate, 2 = advanced; unknown → beginner (no extra lock). */
function difficultyTier(d) {
  const key = String(d || "").toLowerCase();
  if (key === "intermediate") return 1;
  if (key === "advanced") return 2;
  return 0;
}

/** Human-readable names for challenge categories (matches frontend challenge types). */
const CATEGORY_LABELS = {
  phishing: "Phishing",
  malware: "Malware",
  password: "Password",
  general: "General",
  "social-engineering": "Social engineering",
  "incident-response": "Incident response",
};

function categoryDisplayLabel(slug) {
  if (!slug) return "this";
  const key = String(slug).toLowerCase();
  if (CATEGORY_LABELS[key]) return CATEGORY_LABELS[key];
  return String(slug)
    .replace(/-/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

module.exports = {
  PASS_SCORE_PERCENT,
  normalizePassed,
  attemptRowCountsAsPassed,
  difficultyTier,
  categoryDisplayLabel,
};
