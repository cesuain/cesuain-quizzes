import { describe, expect, it } from "vitest";
import achievementsJson from "../../data/achievements.json";
import { ACHIEVEMENT_ICONS, parseAchievementCatalog } from "../../lib/achievements/catalog";
import { progressionFor, xpForLevel } from "../../lib/domain/progression";
import { accuracyPercent } from "../../lib/domain/scoring";
import { ACHIEVEMENT_ICON_COMPONENTS } from "../../components/achievements/icons";

describe("progression", () => {
  it("derives levels from total XP", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(1000);
    expect(xpForLevel(3)).toBe(3000);
    expect(progressionFor(0)).toMatchObject({ level: 1, percent: 0, nextLevelXp: 1000 });
    expect(progressionFor(999)).toMatchObject({ level: 1, percent: 99 });
    expect(progressionFor(1000)).toMatchObject({ level: 2, levelStartXp: 1000, nextLevelXp: 3000, percent: 0 });
    expect(progressionFor(2000)).toMatchObject({ level: 2, percent: 50 });
  });

  it("computes accuracy as first-try correct over questions", () => {
    expect(accuracyPercent(10, 12)).toBe(83.33);
    expect(accuracyPercent(0, 0)).toBe(0);
  });
});

describe("achievement catalog", () => {
  const catalog = parseAchievementCatalog(achievementsJson);

  it("includes the required initial achievements", () => {
    expect(catalog.map((a) => a.slug)).toEqual(
      expect.arrayContaining([
        "first-steps", "quiz-explorer", "dedicated-learner", "quiz-master", "full-marks",
        "level-complete-foundations", "react-specialist", "sharp-mind", "focused-learner", "unstoppable",
        "curious-mind", "knowledge-seeker", "knowledge-builder", "scholar", "expert",
        "getting-the-hang-of-it", "precision", "first-try-champion",
      ]),
    );
  });

  it("has no two achievements with the same criteria", () => {
    const keys = catalog.map((a) => `${a.criteria_type}:${JSON.stringify(a.criteria_config)}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("only references icons the app can render", () => {
    for (const icon of ACHIEVEMENT_ICONS) expect(ACHIEVEMENT_ICON_COMPONENTS[icon]).toBeTruthy();
  });

  it("rejects malformed criteria", () => {
    expect(() =>
      parseAchievementCatalog([{ ...catalog[0], criteria_type: "correct_streak", criteria_config: { count: 0 } }]),
    ).toThrow();
    expect(() => parseAchievementCatalog([catalog[0], catalog[0]])).toThrow(/duplicate slug/);
  });
});
