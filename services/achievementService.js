const achievements = [
  {
    id: "first-step",
    title: "First Step",
    description: "Complete your first activity.",
    requirement: "1 activity",
    isUnlocked: ({ activityCount }) => activityCount >= 1
  },
  {
    id: "lesson-starter",
    title: "Lesson Starter",
    description: "Complete Support Basics.",
    requirement: "Unit 1",
    unitId: 1,
    isUnlocked: ({ completedUnitIds }) => completedUnitIds.has(1)
  },
  {
    id: "writing-starter",
    title: "Writing Starter",
    description: "Complete Ask for Details.",
    requirement: "Unit 2",
    unitId: 2,
    isUnlocked: ({ completedUnitIds }) => completedUnitIds.has(2)
  },
  {
    id: "conversation-ready",
    title: "Conversation Ready",
    description: "Complete Customer Conversation.",
    requirement: "Unit 4",
    unitId: 4,
    isUnlocked: ({ completedUnitIds }) => completedUnitIds.has(4)
  },
  {
    id: "three-day-streak",
    title: "3-Day Streak",
    description: "Study for three days in a row.",
    requirement: "3 days",
    isUnlocked: ({ progress }) => Number(progress.streak_days) >= 3
  },
  {
    id: "hundred-xp",
    title: "100 XP",
    description: "Earn 100 total XP.",
    requirement: "100 XP",
    isUnlocked: ({ progress }) => Number(progress.total_xp) >= 100
  }
];

function buildAchievements(progress, units) {
  const activityCount = Number(progress.lessons_completed) || 0;
  const completedUnitIds = new Set(
    units.filter((unit) => unit.isCompleted).map((unit) => Number(unit.id))
  );

  return achievements.map((achievement) => ({
    ...achievement,
    unlocked: achievement.isUnlocked({
      progress,
      activityCount,
      completedUnitIds
    })
  }));
}

function getAchievementForUnit(unitId, achievementList) {
  return achievementList.find((achievement) => achievement.unitId === Number(unitId)) || null;
}

module.exports = {
  buildAchievements,
  getAchievementForUnit
};
