import { describe, expect, it } from "vitest";
import { activityAction, activityHistory, regionActivityCopy } from "../../games/english-spell-battle/v2/app/activity-copy";
import { ENGLISH_V2_WORDS, ENGLISH_V2_THEMES } from "../../games/english-spell-battle/v2/content/manifest";
import { initialPilotRecord, PILOT_TASK_IDS } from "../../games/english-spell-battle/v2/pilot/model";
import { createDefaultEnglishWorldSave, updateEnglishWorldSave } from "../../games/english-spell-battle/v2/save/save";

describe("activity copy consumes existing records without mastery inference", () => {
  it("describes the six scene actions and 24 original word-card entries", () => {
    const story = ENGLISH_V2_WORDS.filter(word => word.storyBand === "story-core");
    expect(story.filter(word => activityAction(word.id) === "看图拼词")).toHaveLength(24);
    expect(PILOT_TASK_IDS.map(activityAction)).toEqual(["选落点，让角色跑起来", "选落点，让角色跳过去", "选贝壳，涂成红色", "选小船，涂成蓝色", "选一枚贝壳，让它发光", "选两艘小船，让它们启航"]);
    expect(ENGLISH_V2_THEMES).toHaveLength(5);
    for (const theme of ENGLISH_V2_THEMES) expect(regionActivityCopy(theme.id)).toContain("拼");
  });

  it("separates interaction, old word-card and combined histories", () => {
    const fresh = createDefaultEnglishWorldSave();
    expect(activityHistory("word-run", fresh)).toBe("来场景里试一试");
    expect(activityHistory("word-cat", fresh)).toBe("来看看、拼一拼");
    const scene = updateEnglishWorldSave(fresh, { interactions: { "word-run": { ...initialPilotRecord("word-run"), interactionCompleted: true } } });
    expect(activityHistory("word-run", scene)).toBe("场景玩过");
    const oldCard = updateEnglishWorldSave(fresh, { completedStoryWordIds: ["word-run"] });
    expect(activityHistory("word-run", oldCard)).toBe("词卡活动完成过");
    const both = updateEnglishWorldSave(scene, { completedStoryWordIds: ["word-run"] });
    expect(activityHistory("word-run", both)).toBe("场景玩过 · 词卡活动完成过");
    const words = ENGLISH_V2_WORDS.map(word => activityHistory(word.id, both)).join(" ");
    expect(words).not.toMatch(/从未|还没遇见|未掌握|已掌握|独立拼写/);
  });

  it("uses original sentence records as word-card history without inferring independent spelling", () => {
    const word = ENGLISH_V2_WORDS.find(word => word.id === "word-one")!;
    const save = updateEnglishWorldSave(createDefaultEnglishWorldSave(), { completedSentenceIds: [word.sentenceIds[0]] });
    expect(activityHistory(word.id, save)).toBe("词卡活动完成过");
    expect(save.interactions).toEqual({});
  });
});
