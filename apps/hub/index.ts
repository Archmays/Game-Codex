import type { GameDefinition, MountedGame } from "../../packages/game-core";
import { createLocalStorageStore } from "../../packages/game-core";
import { currentClassicGameCatalog } from "../../packages/data/gameCatalog";
import { clearElement, createButton, createPanel } from "../../packages/ui";
import { ALL_SUBJECTS_FILTER, getSubjectFilters } from "./filters";

export function mountHub(root: HTMLElement): MountedGame {
  let mountedGame: MountedGame | null = null;
  let selectedSubject = ALL_SUBJECTS_FILTER;

  const renderHub = (): void => {
    mountedGame?.destroy();
    mountedGame = null;
    root.className = "app-shell";
    clearElement(root);

    const header = document.createElement("header");
    header.className = "hub-header";

    const titleGroup = document.createElement("div");
    const title = document.createElement("h1");
    title.textContent = "游戏百宝箱";
    const subtitle = document.createElement("p");
    subtitle.textContent = "三个游戏世界的备用入口；平时也可以从“我的游戏世界”出发。";
    titleGroup.append(title, subtitle);
    header.append(titleGroup);

    const filters = document.createElement("nav");
    filters.className = "hub-filters";
    filters.setAttribute("aria-label", "按学科筛选游戏");
    for (const subject of getSubjectFilters(currentClassicGameCatalog)) {
      const isActive = subject === selectedSubject;
      const button = createButton(subject, () => {
        selectedSubject = subject;
        renderHub();
      }, {
        className: isActive ? "ui-button learning-game__pill is-active" : "ui-button learning-game__pill"
      });
      button.setAttribute("aria-pressed", String(isActive));
      filters.append(button);
    }

    const grid = document.createElement("main");
    grid.className = "hub-grid";

    const visibleGames = selectedSubject === ALL_SUBJECTS_FILTER
      ? currentClassicGameCatalog
      : currentClassicGameCatalog.filter((game) => game.subject === selectedSubject);

    for (const game of visibleGames) {
      grid.append(createGameCard(game, () => openGame(game)));
    }

    root.append(header, filters, grid);
  };

  const openGame = (game: GameDefinition): void => {
    if (game.route) {
      window.location.assign(game.route);
      return;
    }
    mountedGame?.destroy();
    mountedGame = null;
    root.className = "game-runner";
    clearElement(root);

    const topbar = document.createElement("div");
    topbar.className = "game-topbar";
    const backButton = createButton("返回大厅", renderHub, {
      className: "ui-button ui-button--secondary"
    });
    const title = document.createElement("h1");
    title.textContent = game.title;
    topbar.append(backButton, title);

    const stage = document.createElement("main");
    stage.className = "game-stage";
    root.append(topbar, stage);

    mountedGame = game.mount({
      container: stage,
      onExit: renderHub,
      storage: createLocalStorageStore(game.id)
    });
  };

  renderHub();

  return {
    destroy(): void {
      mountedGame?.destroy();
      mountedGame = null;
      clearElement(root);
    }
  };
}

function createGameCard(game: GameDefinition, onPlay: () => void): HTMLElement {
  const card = createPanel("game-card");
  card.dataset.gameId = game.id;

  if (game.id === "hanzi-radical-battle") {
    card.classList.add("game-card--ink-forest");
    const title = document.createElement("h2");
    title.textContent = game.title;
    const worldArt = document.createElement("img");
    worldArt.className = "game-card__world-art";
    worldArt.src = "./assets/hanzi-radical-battle/v2/theme-c/chapter-one/hub-ink-forest.webp";
    worldArt.alt = "夜色墨迹森林里有发光小径、魔法树和温和的墨点伙伴";
    const description = document.createElement("p");
    description.textContent = game.description;
    const button = createButton(game.playLabel ?? "进入墨迹森林", onPlay, { className: "ui-button game-card__button" });
    card.append(title, worldArt, description, button);
    return card;
  }

  if (game.id === "math-lab") {
    card.classList.add("game-card--math-world");
    const title = document.createElement("h2");
    title.textContent = game.title;
    const worldArt = document.createElement("img");
    worldArt.className = "game-card__world-art";
    worldArt.src = "./assets/math-world/math-world-city-background.webp";
    worldArt.alt = "明亮的数学实验城市，里面有苹果园、钟楼、方格工坊、数字牌屋和火车站";
    const description = document.createElement("p");
    description.textContent = game.description;
    const button = createButton(game.playLabel ?? "进入数学世界", onPlay, { className: "ui-button game-card__button" });
    card.append(title, worldArt, description, button);
    return card;
  }

  const title = document.createElement("h2");
  title.textContent = game.title;

  const description = document.createElement("p");
  description.textContent = game.description;

  const button = createButton(game.playLabel ?? "开始游戏", onPlay, {
    className: "ui-button game-card__button"
  });

  card.append(title, description, button);
  return card;
}
