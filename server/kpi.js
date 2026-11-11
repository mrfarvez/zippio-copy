const DAY_MS = 24 * 60 * 60 * 1000;
const EARLY_BONUS = [
  [4, 0.20],
  [3, 0.15],
  [2, 0.10],
  [1, 0.05],
];

export function defaultPointsForPriority(priority) {
  return { Low: 10, Medium: 15, High: 20, Critical: 30 }[priority];
}

export function calculateKpiScore({ basePoints, deadline, submittedAt = null, now = new Date() }) {
  const deadlineTime = new Date(deadline).getTime();
  const comparisonTime = new Date(submittedAt || now).getTime();
  if (!Number.isFinite(deadlineTime) || !Number.isFinite(comparisonTime)) throw new Error("Invalid KPI timestamp");

  const difference = deadlineTime - comparisonTime;
  if (difference >= 0) {
    const earlyDays = Math.floor(difference / DAY_MS);
    const bonusRate = EARLY_BONUS.find(([days]) => earlyDays >= days)?.[1] || 0;
    return {
      score: roundScore(basePoints * (1 + bonusRate)),
      bonusRate,
      penaltyRate: 0,
      lateDays: 0,
      overdue: false,
      scoringStatus: submittedAt && difference > 0 ? "early" : "on_time",
    };
  }

  const lateDays = Math.floor(Math.abs(difference) / DAY_MS);
  const penaltyRate = Math.round(Math.min(lateDays * 0.10, 1.50) * 100) / 100;
  const score = Math.max(-basePoints * 0.5, basePoints - basePoints * penaltyRate);
  return {
    score: roundScore(score),
    bonusRate: 0,
    penaltyRate,
    lateDays,
    overdue: true,
    scoringStatus: submittedAt ? "late" : "overdue",
  };
}

function roundScore(value) {
  return Math.round(value);
}
