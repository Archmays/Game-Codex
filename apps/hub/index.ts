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
    title.textContent = "儿童学习游戏大厅";
    const subtitle = document.createElement("p");
    subtitle.textContent = "选择一个短小游戏，在手机、平板或电脑上练习识字、数学、英语和亲子互动。";
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
    const title = document.createElement("strong");
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
    const button = createButton(game.playLabel ?? "进入墨迹森林", onPlay, { className: "ui-button game-card__button" });
    card.append(title, worldArt, button);
    return card;
  }

  const meta = document.createElement("div");
  meta.className = "game-card__meta";

  const subject = document.createElement("span");
  subject.className = "game-card__subject";
  subject.textContent = game.subject;

  const status = document.createElement("span");
  status.className = "game-card__status";
  status.textContent = game.status;

  meta.append(subject, status);

  const title = document.createElement("h2");
  title.textContent = game.title;

  const description = document.createElement("p");
  description.textContent = game.description;

  const goal = document.createElement("p");
  goal.className = "game-card__goal";
  goal.textContent = `学习目标：${game.learningGoal}`;

  const age = document.createElement("div");
  age.className = "game-card__age";
  age.textContent = `适合年龄：${game.recommendedAge}`;

  const button = createButton(game.playLabel ?? "开始游戏", onPlay, {
    className: "ui-button game-card__button"
  });

  card.append(meta, title, description, goal, age, button);
  return card;
}
