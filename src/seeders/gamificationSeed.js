const { LearningChallenge, GamificationAchievement, LearningChallengeCategory } = require("../models");
const seedData = require("./gamificationSeedData");

const CRITERIA_MAP = {
  "1": "first_pass",
  "2": "streak_7",
  "3": "password_category",
};

async function seedGamification() {
  const { challenges, achievements } = seedData;
  if (!challenges?.length) {
    console.warn("gamificationSeed: no challenges in gamificationSeedData.js");
    return;
  }

  for (const c of challenges) {
    await LearningChallenge.upsert({
      id: String(c.id),
      org_id: null,
      title: c.title,
      description: c.description || "",
      type: c.type,
      category: c.category,
      difficulty: c.difficulty,
      duration: c.duration ?? 0,
      xp_reward: c.xpReward ?? 0,
      reputation_reward: c.reputationReward ?? 0,
      steps: c.steps || [],
      is_active: true,
    });
  }

  for (const a of achievements || []) {
    await GamificationAchievement.upsert({
      id: String(a.id),
      title: a.title,
      description: a.description || "",
      icon: a.icon || "award",
      target_count: a.total ?? 1,
      criteria_key: CRITERIA_MAP[String(a.id)] || "first_pass",
    });
  }

  const defaultCategories = [
    { name: "Phishing", image_url: "" },
    { name: "Malware", image_url: "" },
    { name: "Password Security", image_url: "" },
    { name: "General Awareness", image_url: "" },
    { name: "Social Engineering", image_url: "" },
    { name: "Incident Response", image_url: "" }
  ];

  for (const cat of defaultCategories) {
    const slug = cat.name.toLowerCase().replace(/\s+/g, '-');
    const existing = await LearningChallengeCategory.findOne({ where: { name: slug } });
    
    if (!existing) {
      await LearningChallengeCategory.create({
        name: slug,
        display_name: cat.name,
        image_url: cat.image_url
      });
    } else {
      await existing.update({
        display_name: cat.name,
        image_url: existing.image_url || cat.image_url
      });
    }
  }

  console.log(`Gamification seed: ${challenges.length} challenges, ${(achievements || []).length} achievements, ${defaultCategories.length} categories`);
}

module.exports = seedGamification;
