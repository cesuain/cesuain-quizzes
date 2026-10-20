/**
 * Progression levels are derived from total official XP: level n starts at
 * 500 · n · (n − 1) XP, so each level takes 1,000 XP more than the previous one
 * (L2 at 1,000, L3 at 3,000, L4 at 6,000…).
 */
const STEP = 500;

export function xpForLevel(level: number): number {
  return STEP * level * (level - 1);
}

export interface Progression {
  level: number;
  xp: number;
  levelStartXp: number;
  nextLevelXp: number;
  /** 0–100 progress within the current level. */
  percent: number;
}

export function progressionFor(totalXp: number): Progression {
  const xp = Math.max(0, Math.floor(totalXp));
  let level = 1;
  while (xpForLevel(level + 1) <= xp) level++;
  const levelStartXp = xpForLevel(level);
  const nextLevelXp = xpForLevel(level + 1);
  return {
    level,
    xp,
    levelStartXp,
    nextLevelXp,
    percent: Math.floor(((xp - levelStartXp) / (nextLevelXp - levelStartXp)) * 100),
  };
}
