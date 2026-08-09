const MAX_CHILD_COPY_LENGTH = 16;

export const GOLDEN_CHILD_COPY = {
  campIntro: "营地的灯暗了",
  enterEncounter: "去找回字灵",
  chooseCard: "选一张字灵",
  chooseSlot: "送回它的位置",
  warmRetry: "换个位置看看",
  guardianLight: "护字光照出轮廓",
  starPath: "星光指向空位",
  bossInterference: "迷墨遮住了路",
  bossRecovery: "路又清楚了",
  safeRetry: "字灵都在这里",
  chooseAbility: "选一个新魔法",
  returnCamp: "带星光回营地",
  campRepaired: "营地亮起来了",
  spellbook: "新字住进魔法书",
  replay: "试试另一个魔法",
} as const;

export type GoldenChildCopyId = keyof typeof GOLDEN_CHILD_COPY;

export const GOLDEN_CHILD_COPY_MAX_LENGTH = MAX_CHILD_COPY_LENGTH;
