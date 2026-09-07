export const WORLD_COPY = {
  title: "我的游戏世界",
  subtitle: "今天想去哪里？",
  forestTitle: "字阵守城",
  forestFreshAction: "开始守城",
  forestReturnAction: "再次守城",
  mathTitle: "数学世界",
  mathAction: "走进数学世界",
  treasureTitle: "游戏百宝箱",
  treasureAction: "打开百宝箱",
  settingsAction: "声音、画面和家长角",
  closeAction: "回到游戏世界",
} as const;

export const WORLD_PRIMARY_COPY = Object.values(WORLD_COPY).join("\n");
