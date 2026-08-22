export const WORLD_COPY = {
  title: "我的游戏世界",
  subtitle: "今天想去哪里？",
  forestTitle: "墨迹森林",
  forestFreshAction: "走进墨迹森林",
  forestReturnAction: "再去墨迹森林",
  mathTitle: "数学实验城",
  mathAction: "走进数学世界",
  englishTitle: "词光岛",
  englishAction: "走进英语世界",
  treasureTitle: "游戏百宝箱",
  treasureAction: "打开百宝箱",
  settingsAction: "声音和画面",
  closeAction: "回到游戏世界",
} as const;

export const WORLD_PRIMARY_COPY = Object.values(WORLD_COPY).join("\n");
