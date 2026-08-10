import type { GameDefinition, MountGameContext, MountedGame } from "../../packages/game-core";
import { clearElement, createButton, createStatus } from "../../packages/ui";
import {
  BASE_HAND_SIZE,
  HANZI_RADICAL_COMBINATION_DB,
  HANZI_RADICAL_COMBINATION_ENTRIES,
  HANZI_RADICAL_DECK,
  HANZI_RADICAL_HEROES,
  HANZI_RADICAL_MONSTERS,
  MAX_HINTS,
  getHanziRadicalCombination,
  type HanziRadicalCombo,
  type HanziRadicalHero,
  type HanziRadicalMonster,
  type HanziRadicalStructure
} from "./game-data";
import {
  getHanziRadicalVisualHint,
  type HanziRadicalVisualHint
} from "./visual-hints";

type HanziRadicalScene = "menu" | "charSelect" | "instructions" | "game";
type HanziRadicalTurn = "player" | "enemy";
type HanziRadicalStatus = "playing" | "lost";
type HanziRadicalLogType = "player" | "enemy" | "info";
type FloatingTextType = "damage" | "heal" | "block" | "info" | "achievement";
type Rarity = "normal" | "rare" | "epic";
type BattleSound =
  | "select"
  | "attack_normal"
  | "attack_rare"
  | "attack_epic"
  | "crit"
  | "win"
  | "hit"
  | "block"
  | "heal";

interface BattleCard {
  id: string;
  char: string;
}

interface BattleLog {
  id: string;
  text: string;
  type: HanziRadicalLogType;
  time: string;
}

interface FloatingText {
  id: string;
  text: string;
  type: FloatingTextType;
  rarity?: Rarity | "crit";
}

const ENEMY_TURN_DELAY_MS = 1200;
const ENEMY_ATTACK_ANIMATION_MS = 400;
const MONSTER_HIT_ANIMATION_MS = 300;
const FLOATING_TEXT_MS = 1000;
const NEXT_MONSTER_DELAY_MS = 1500;

let audioContext: AudioContext | null = null;

export const hanziRadicalBattleGame: GameDefinition = {
  id: "hanzi-radical-battle",
  title: "汉字魔法战-偏旁部首",
  description: "组合偏旁部首生成汉字，释放魔法打败怪物。",
  subject: "识字",
  recommendedAge: "6-10 岁",
  learningGoal: "认识偏旁部首的组合关系，理解汉字结构和常见字义。",
  status: "可玩",
  playLabel: "挑战偏旁",
  mount(context: MountGameContext): MountedGame {
    return mountHanziRadicalBattle(context);
  }
};

function mountHanziRadicalBattle(context: MountGameContext): MountedGame {
  const root = document.createElement("section");
  root.className = "hanzi-radical-battle";
  context.container.append(root);

  let scene: HanziRadicalScene = "menu";
  let character: HanziRadicalHero = HANZI_RADICAL_HEROES[0];
  let playerHp = 100;
  let maxPlayerHp = 100;
  let mp = 3;
  let hand: BattleCard[] = [];
  let selectedIndices: number[] = [];
  let level = 1;
  let monsterHp = 50;
  let maxMonsterHp = 50;
  let currentMonster: HanziRadicalMonster = HANZI_RADICAL_MONSTERS[0];
  let shield = 0;
  let turn: HanziRadicalTurn = "player";
  let gameStatus: HanziRadicalStatus = "playing";
  let comboResult: HanziRadicalCombo | null = null;
  let hintIndices: number[] = [];
  let hintsLeft = 3;
  let floatingTexts: FloatingText[] = [];
  let monsterHit = false;
  let monsterAttacking = false;
  let soundEnabled = true;
  let discoveredWords: string[] = [];
  let battleLogs: BattleLog[] = [];
  let showLogs = false;
  let showDictionary = false;
  let idCounter = 0;
  const timers = new Set<number>();

  const nextId = (): string => {
    idCounter += 1;
    return `${Date.now()}_${idCounter}`;
  };

  const setManagedTimeout = (callback: () => void, delay: number): number => {
    const timer = window.setTimeout(() => {
      timers.delete(timer);
      callback();
    }, delay);
    timers.add(timer);
    return timer;
  };

  const clearManagedTimers = (): void => {
    for (const timer of timers) {
      window.clearTimeout(timer);
    }
    timers.clear();
  };

  const render = (): void => {
    root.className = `hanzi-radical-battle hanzi-radical-battle--${scene}`;
    clearElement(root);
    root.append(createFloatingLayer());

    if (scene === "menu") {
      renderMenu();
    } else if (scene === "charSelect") {
      renderCharacterSelect();
    } else if (scene === "instructions") {
      renderInstructions();
    } else {
      renderGame();
    }

    if (showLogs) {
      root.append(createBattleLogModal());
    }
    if (showDictionary) {
      root.append(createDictionaryModal());
    }
  };

  const renderMenu = (): void => {
    const menu = document.createElement("section");
    menu.className = "hanzi-radical-menu";

    const titleBlock = document.createElement("div");
    titleBlock.className = "hanzi-radical-title";
    const title = document.createElement("h2");
    title.textContent = "汉字魔法战";
    const subtitle = document.createElement("p");
    subtitle.textContent = "- 偏旁部首 -";
    titleBlock.append(title, subtitle);

    const startButton = createButton("▶ 开始冒险", () => {
      initAudio();
      playBattleSound("select", soundEnabled);
      scene = "charSelect";
      render();
    }, { className: "ui-button hanzi-radical-primary-action" });

    const actions = document.createElement("div");
    actions.className = "hanzi-radical-menu-actions";
    actions.append(
      createButton("游戏说明", () => {
        scene = "instructions";
        render();
      }, { className: "ui-button ui-button--secondary" }),
      createButton("图鉴", () => {
        showDictionary = true;
        render();
      }, { className: "ui-button ui-button--secondary" })
    );

    menu.append(titleBlock, startButton, actions);
    root.append(menu);
  };

  const renderCharacterSelect = (): void => {
    const screen = document.createElement("section");
    screen.className = "hanzi-radical-character-screen";
    screen.append(createScreenTitle("选择你的英雄", "每位英雄有不同生命、伤害和技能。"));

    const grid = document.createElement("div");
    grid.className = "hanzi-radical-character-grid";
    for (const hero of HANZI_RADICAL_HEROES) {
      const card = document.createElement("button");
      card.type = "button";
      card.className = "hanzi-radical-hero-card";
      card.addEventListener("click", () => {
        playBattleSound("select", soundEnabled);
        startGame(hero);
      });

      const icon = document.createElement("div");
      icon.className = "hanzi-radical-hero-card__icon";
      icon.textContent = hero.icon;
      const name = document.createElement("h3");
      name.textContent = hero.name;
      const desc = document.createElement("p");
      desc.textContent = hero.desc;
      const skill = document.createElement("div");
      skill.className = "hanzi-radical-hero-card__skill";
      skill.textContent = `技能：${hero.skillName}，${hero.skillDesc}（消耗 ${hero.skillCost} 墨水）`;
      card.append(icon, name, desc, skill);
      grid.append(card);
    }

    const back = createButton("返回", () => {
      scene = "menu";
      render();
    }, { className: "ui-button ui-button--secondary" });
    screen.append(grid, back);
    root.append(screen);
  };

  const renderInstructions = (): void => {
    const screen = document.createElement("section");
    screen.className = "hanzi-radical-instructions";
    screen.append(createScreenTitle("游戏说明", "通过组合偏旁部首，释放汉字魔法攻击怪物！"));

    const list = document.createElement("ul");
    for (const item of [
      "攻击：选中2个或更多卡牌组成汉字。",
      "结构：留意汉字的结构（左右、上下、包围），合理组合威力更大！",
      "属性克制：观察怪物的弱点，用对应的偏旁造成暴击。",
      "墨水：组合汉字可恢复墨水，墨水用于释放角色必杀技。",
      "防御：手牌不佳时点击防御，可弃牌重抽并获得护盾。"
    ]) {
      const li = document.createElement("li");
      li.textContent = item;
      list.append(li);
    }

    screen.append(list, createButton("返回", () => {
      scene = "menu";
      render();
    }, { className: "ui-button" }));
    root.append(screen);
  };

  const renderGame = (): void => {
    const shell = document.createElement("section");
    shell.className = "hanzi-radical-game-shell";
    shell.append(createGameHeader(), createMonsterPanel(), createPlayerPanel());

    if (gameStatus !== "playing") {
      shell.append(createGameOverOverlay());
    }

    root.append(shell);
  };

  const createGameHeader = (): HTMLElement => {
    const header = document.createElement("header");
    header.className = "hanzi-radical-game-header";

    const left = document.createElement("div");
    left.className = "hanzi-radical-game-header__group";
    left.append(
      createHeaderButton("⌂", "主菜单", () => {
        returnToMenu();
      }),
      createLabel(`${character.icon} ${character.name}`)
    );

    const right = document.createElement("div");
    right.className = "hanzi-radical-game-header__group";
    right.append(
      createStatus("关卡", `Lv.${level}`),
      createHeaderButton(soundEnabled ? "🔊" : "🔇", "音效", () => {
        soundEnabled = !soundEnabled;
        if (soundEnabled) {
          playBattleSound("select", true);
        }
        render();
      }),
      createHeaderButton("记录", "战斗记录", () => {
        showLogs = true;
        render();
      }),
      createHeaderButton("宝典", "汉字宝典", () => {
        showDictionary = true;
        render();
      })
    );

    header.append(left, right);
    return header;
  };

  const createMonsterPanel = (): HTMLElement => {
    const panel = document.createElement("section");
    panel.className = "hanzi-radical-monster-panel";

    const turnBadge = document.createElement("div");
    turnBadge.className = `hanzi-radical-turn-badge hanzi-radical-turn-badge--${turn}`;
    turnBadge.textContent = turn === "player" ? "你的回合" : "敌方行动";

    const monster = document.createElement("div");
    monster.className = `hanzi-radical-monster${monsterHit ? " is-hit" : ""}${monsterAttacking ? " is-attacking" : ""}`;
    const health = document.createElement("div");
    health.className = "hanzi-radical-health";
    health.append(createHealthFill(monsterHp, maxMonsterHp, "monster"));

    const body = document.createElement("div");
    body.className = "hanzi-radical-monster__body";
    body.textContent = currentMonster.icon;

    const weakness = document.createElement("div");
    weakness.className = "hanzi-radical-monster__weakness";
    weakness.textContent = `弱点：${getWeaknessLabel(currentMonster.weakness)}`;

    const name = document.createElement("strong");
    name.textContent = `Lv.${level} ${currentMonster.name}`;
    const desc = document.createElement("span");
    desc.textContent = currentMonster.desc;
    const hp = document.createElement("span");
    hp.textContent = `HP：${monsterHp}/${maxMonsterHp}`;

    monster.append(health, body, weakness, name, desc, hp);
    panel.append(turnBadge, monster);
    return panel;
  };

  const createPlayerPanel = (): HTMLElement => {
    const panel = document.createElement("section");
    panel.className = "hanzi-radical-player-panel";

    const status = document.createElement("div");
    status.className = "hanzi-radical-player-status";
    const hp = document.createElement("div");
    hp.className = "hanzi-radical-player-hp";
    hp.textContent = `♥ ${playerHp}/${maxPlayerHp}`;
    hp.append(createHealthFill(playerHp, maxPlayerHp, "player"));
    status.append(hp);

    if (shield > 0) {
      const shieldBadge = document.createElement("div");
      shieldBadge.className = "hanzi-radical-shield";
      shieldBadge.textContent = `盾 ${shield}`;
      status.append(shieldBadge);
    }
    status.append(createMpBar(mp));

    const controls = document.createElement("div");
    controls.className = "hanzi-radical-controls";
    controls.append(
      createButton(`⚡ ${character.skillName} (${character.skillCost})`, useSkill, {
        className: "ui-button hanzi-radical-skill-button",
        disabled: turn !== "player" || mp < character.skillCost
      }),
      createButton(`💡 提示 ${hintsLeft}`, useHint, {
        className: "ui-button ui-button--secondary",
        disabled: turn !== "player" || hintsLeft <= 0
      }),
      createButton("盾 防御", handleDefend, {
        className: "ui-button ui-button--secondary",
        disabled: turn !== "player"
      })
    );

    const comboPanel = createComboPanel();
    const handGrid = document.createElement("div");
    handGrid.className = "hanzi-radical-hand";
    for (let index = 0; index < hand.length; index += 1) {
      handGrid.append(createCardButton(hand[index], index));
    }

    panel.append(status, controls, comboPanel, handGrid);
    return panel;
  };

  const createComboPanel = (): HTMLElement => {
    const panel = document.createElement("div");
    panel.className = "hanzi-radical-combo-panel";

    if (!comboResult) {
      const message = document.createElement("span");
      message.textContent = selectedIndices.length === 0 ? "点击卡牌组合" : "继续寻找可以组成的汉字";
      const tags = document.createElement("div");
      tags.className = "hanzi-radical-structure-tags";
      for (const label of ["左右", "上下", "包围"]) {
        const tag = document.createElement("span");
        tag.textContent = label;
        tags.append(tag);
      }
      panel.append(message, tags);
      return panel;
    }

    const rarity = getHanziRadicalRarity(comboResult.type);
    const selectedParts = selectedIndices.map((index) => hand[index].char);
    const visualHint = getHanziRadicalVisualHint(comboResult, selectedParts);
    const attack = document.createElement("button");
    attack.type = "button";
    attack.className = `hanzi-radical-attack-preview hanzi-radical-attack-preview--${rarity}`;
    attack.addEventListener("click", handleAttack);

    const text = document.createElement("div");
    text.className = "hanzi-radical-attack-preview__text";
    const struct = document.createElement("span");
    struct.className = "hanzi-radical-structure";
    struct.textContent = getStructureLabel(comboResult.struct);
    const char = document.createElement("strong");
    char.textContent = comboResult.char.split("/")[0];
    const detail = document.createElement("span");
    detail.textContent = `${comboResult.desc} · 威力 ${calculateHanziRadicalDamage(comboResult, character, currentMonster)}`;
    if (currentMonster.weakness !== "none" && comboResult.type === currentMonster.weakness) {
      detail.textContent += " · 克制!";
    }
    text.append(struct, char, detail);
    attack.append(createHanziRadicalVisualCard(visualHint), text);
    panel.append(attack);
    return panel;
  };

  const createCardButton = (card: BattleCard, index: number): HTMLButtonElement => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hanzi-radical-card";
    if (selectedIndices.includes(index)) {
      button.classList.add("is-selected");
    }
    if (hintIndices.includes(index)) {
      button.classList.add("is-hinted");
    }
    button.disabled = gameStatus !== "playing" || turn !== "player";
    button.addEventListener("click", () => handleCardClick(index));

    const label = document.createElement("span");
    label.textContent = "部首";
    const char = document.createElement("strong");
    char.textContent = card.char;
    button.append(label, char);
    return button;
  };

  const createGameOverOverlay = (): HTMLElement => {
    const overlay = document.createElement("div");
    overlay.className = "hanzi-radical-game-over";
    const title = document.createElement("h3");
    title.textContent = "先回营地休息一下";
    const text = document.createElement("p");
    text.textContent = "这次发现的汉字都还在。换个方法再试一次。";
    const actions = document.createElement("div");
    actions.append(
      createButton("再来一局", () => {
        playBattleSound("select", soundEnabled);
        startGame(character);
      }),
      createButton("主菜单", returnToMenu, { className: "ui-button ui-button--secondary" })
    );
    overlay.append(title, text, actions);
    return overlay;
  };

  const createBattleLogModal = (): HTMLElement => {
    const modal = createModal("战斗记录", () => {
      showLogs = false;
      render();
    });
    const list = document.createElement("div");
    list.className = "hanzi-radical-log-list";
    if (battleLogs.length === 0) {
      const empty = document.createElement("p");
      empty.textContent = "战斗才刚刚开始...";
      list.append(empty);
    }
    for (const log of battleLogs) {
      const item = document.createElement("div");
      item.className = `hanzi-radical-log hanzi-radical-log--${log.type}`;
      const time = document.createElement("span");
      time.textContent = log.time;
      item.append(time, document.createTextNode(log.text));
      list.append(item);
    }
    modal.querySelector(".hanzi-radical-modal__body")?.append(list);
    setManagedTimeout(() => {
      list.scrollTop = list.scrollHeight;
    }, 0);
    return modal;
  };

  const createDictionaryModal = (): HTMLElement => {
    const modal = createModal("汉字宝典", () => {
      showDictionary = false;
      render();
    });
    const grid = document.createElement("div");
    grid.className = "hanzi-radical-dictionary";

    for (const result of Object.values(HANZI_RADICAL_COMBINATION_DB)) {
      if (!result) {
        continue;
      }
      const unlocked = discoveredWords.includes(result.char);
      const rarity = getHanziRadicalRarity(result.type);
      const tile = document.createElement("div");
      tile.className = `hanzi-radical-dictionary-tile hanzi-radical-dictionary-tile--${rarity}${unlocked ? " is-unlocked" : ""}`;
      const structure = document.createElement("span");
      structure.textContent = unlocked ? getStructureLabel(result.struct) : "";
      const char = document.createElement("strong");
      char.textContent = unlocked ? result.char.split("/")[0] : "?";
      tile.append(structure, char);
      grid.append(tile);
    }

    modal.querySelector(".hanzi-radical-modal__body")?.append(grid);
    return modal;
  };

  const createFloatingLayer = (): HTMLElement => {
    const layer = document.createElement("div");
    layer.className = "hanzi-radical-floating-layer";
    for (const item of floatingTexts) {
      const text = document.createElement("div");
      text.className = `hanzi-radical-floating hanzi-radical-floating--${item.type}`;
      if (item.rarity) {
        text.classList.add(`hanzi-radical-floating--${item.rarity}`);
      }
      text.textContent = item.text;
      layer.append(text);
    }
    return layer;
  };

  const returnToMenu = (): void => {
    clearManagedTimers();
    monsterAttacking = false;
    monsterHit = false;
    showLogs = false;
    showDictionary = false;
    floatingTexts = [];
    scene = "menu";
    render();
  };

  const startGame = (selectedCharacter: HanziRadicalHero): void => {
    initAudio();
    clearManagedTimers();
    character = selectedCharacter;
    maxPlayerHp = 100 + selectedCharacter.hpBonus;
    playerHp = maxPlayerHp;
    level = 1;
    maxMonsterHp = 50;
    monsterHp = 50;
    currentMonster = HANZI_RADICAL_MONSTERS[0];
    hand = drawHanziRadicalCards([], BASE_HAND_SIZE + (selectedCharacter.handSizeBonus ?? 0), nextId);
    selectedIndices = [];
    hintIndices = [];
    comboResult = null;
    gameStatus = "playing";
    turn = "player";
    hintsLeft = 3;
    mp = 3;
    shield = 0;
    monsterHit = false;
    monsterAttacking = false;
    floatingTexts = [];
    battleLogs = [];
    scene = "game";
    addLog(`游戏开始！选择了英雄：${selectedCharacter.name}`, "info");
    addLog(`遭遇了 ${HANZI_RADICAL_MONSTERS[0].name}`, "info");
    render();
  };

  const handleCardClick = (index: number): void => {
    if (gameStatus !== "playing" || turn !== "player") {
      return;
    }
    playBattleSound("select", soundEnabled);
    hintIndices = [];
    selectedIndices = selectedIndices.includes(index)
      ? selectedIndices.filter((selectedIndex) => selectedIndex !== index)
      : [...selectedIndices, index];
    updateComboResult();
    render();
  };

  const handleAttack = (): void => {
    if (!comboResult || turn !== "player") {
      return;
    }

    const damage = calculateHanziRadicalDamage(comboResult, character, currentMonster);
    const usedChars = selectedIndices.map((index) => hand[index].char).join("+");
    const isWeaknessHit = currentMonster.weakness !== "none" && comboResult.type === currentMonster.weakness;
    const rarity = getHanziRadicalRarity(comboResult.type);
    playBattleSound(isWeaknessHit ? "crit" : rarity === "epic" ? "attack_epic" : rarity === "rare" ? "attack_rare" : "attack_normal", soundEnabled);
    addLog(`组合【${usedChars}】=【${comboResult.char.split("/")[0]}】，造成 ${damage} 点伤害${isWeaknessHit ? " (属性克制!)" : ""}！`, "player");

    monsterHp = Math.max(0, monsterHp - damage);
    monsterHit = true;
    setManagedTimeout(() => {
      monsterHit = false;
      render();
    }, MONSTER_HIT_ANIMATION_MS);
    addFloatingText(`-${damage}`, "damage", isWeaknessHit ? "crit" : rarity);

    if (comboResult.type === "heal" || comboResult.type === "defense") {
      const healAmount = 10;
      playerHp = Math.min(maxPlayerHp, playerHp + healAmount);
      addFloatingText(`+${healAmount}`, "heal");
      addLog(`触发特效，回复 ${healAmount} 点生命值。`, "player");
      playBattleSound("heal", soundEnabled);
    }

    if (!discoveredWords.includes(comboResult.char)) {
      discoveredWords = [...discoveredWords, comboResult.char];
      addFloatingText("新字解锁!", "achievement");
    }

    const usedIndexes = new Set(selectedIndices);
    const remainingHand = hand.filter((_, index) => !usedIndexes.has(index));
    const maxHandSize = BASE_HAND_SIZE + (character.handSizeBonus ?? 0);
    hand = [
      ...remainingHand,
      ...drawHanziRadicalCards(remainingHand, maxHandSize - remainingHand.length, nextId)
    ];
    const selectedCount = selectedIndices.length;
    selectedIndices = [];
    comboResult = null;
    hintIndices = [];
    mp = Math.min(10, mp + (selectedCount >= 3 ? 2 : 1));

    if (monsterHp <= 0) {
      setManagedTimeout(handleMonsterDefeat, MONSTER_HIT_ANIMATION_MS);
    } else {
      turn = "enemy";
      scheduleEnemyTurn();
    }
    render();
  };

  const useSkill = (): void => {
    if (mp < character.skillCost || turn !== "player") {
      addFloatingText("墨水不足!", "block");
      render();
      return;
    }

    playBattleSound("heal", soundEnabled);
    mp -= character.skillCost;
    addLog(`使用了技能【${character.skillName}】，消耗 ${character.skillCost} 墨水。`, "player");

    if (character.skill.kind === "damage") {
      const previousHp = monsterHp;
      monsterHp = Math.max(0, monsterHp - character.skill.amount);
      const damage = previousHp - monsterHp;
      addFloatingText(`-${damage}`, "damage");
      addLog(`技能造成 ${damage} 点伤害。`, "player");
      monsterHit = true;
      setManagedTimeout(() => {
        monsterHit = false;
        render();
      }, MONSTER_HIT_ANIMATION_MS);
      if (monsterHp <= 0) {
        setManagedTimeout(handleMonsterDefeat, MONSTER_HIT_ANIMATION_MS);
      }
    } else {
      const previousHp = playerHp;
      playerHp = Math.min(maxPlayerHp + character.skill.maxHpBonus, playerHp + character.skill.amount);
      const heal = playerHp - previousHp;
      addFloatingText(`+${heal}`, "heal");
      addLog(`技能回复 ${heal} 点生命值。`, "player");
    }

    render();
  };

  const handleDefend = (): void => {
    if (turn !== "player") {
      return;
    }

    playBattleSound("block", soundEnabled);
    shield += 10;
    addFloatingText("防御!", "block");
    addLog("进入防御姿态，获得 10 点护盾，并重置手牌。", "info");
    hand = drawHanziRadicalCards([], BASE_HAND_SIZE + (character.handSizeBonus ?? 0), nextId);
    selectedIndices = [];
    hintIndices = [];
    comboResult = null;
    turn = "enemy";
    scheduleEnemyTurn();
    render();
  };

  const useHint = (): void => {
    if (hintsLeft <= 0 || turn !== "player") {
      addFloatingText("次数不足!", "block");
      render();
      return;
    }

    playBattleSound("select", soundEnabled);
    const solutionIndices = findFirstValidHanziRadicalCombo(hand);
    if (solutionIndices) {
      hintIndices = solutionIndices;
      hintsLeft -= 1;
      addFloatingText("发现组合!", "info");
      addLog("使用了提示功能。", "info");
    } else {
      addFloatingText("无解，请防御", "info");
      addLog("提示：当前手牌无法组合，建议使用防御。", "info");
    }
    render();
  };

  const scheduleEnemyTurn = (): void => {
    setManagedTimeout(monsterAttack, ENEMY_TURN_DELAY_MS);
  };

  const monsterAttack = (): void => {
    if (scene !== "game" || turn !== "enemy" || gameStatus !== "playing") {
      return;
    }

    monsterAttacking = true;
    render();
    setManagedTimeout(() => {
      const baseDamage = 8 + Math.floor(level * 1.5);
      const variance = Math.floor(Math.random() * 4) - 2;
      const rawDamage = Math.max(1, baseDamage + variance);
      let actualDamage = rawDamage;

      if (shield > 0) {
        if (shield >= rawDamage) {
          actualDamage = 0;
          shield -= rawDamage;
          addFloatingText("格挡!", "block");
          addLog(`${currentMonster.name} 攻击造成 ${rawDamage} 点伤害，被护盾完全抵消！`, "info");
        } else {
          actualDamage = rawDamage - shield;
          shield = 0;
          addLog(`${currentMonster.name} 攻击造成 ${rawDamage} 点伤害，护盾抵消了部分伤害。`, "enemy");
        }
      } else {
        addLog(`${currentMonster.name} 攻击造成 ${rawDamage} 点伤害！`, "enemy");
      }

      playBattleSound(actualDamage > 0 ? "hit" : "block", soundEnabled);
      if (actualDamage > 0) {
        playerHp = Math.max(0, playerHp - actualDamage);
        addFloatingText(`-${actualDamage}`, "damage");
      }

      monsterAttacking = false;
      if (playerHp <= 0) {
        gameStatus = "lost";
        addLog("先回营地休息一下，发现的汉字都还在。", "enemy");
        playBattleSound("attack_normal", soundEnabled);
      } else {
        turn = "player";
        mp = Math.min(10, mp + 1);
      }
      render();
    }, ENEMY_ATTACK_ANIMATION_MS);
  };

  const handleMonsterDefeat = (): void => {
    if (monsterHp > 0 || gameStatus !== "playing") {
      return;
    }

    playBattleSound("win", soundEnabled);
    addFloatingText("胜利!", "achievement");
    addLog(`击败了 ${currentMonster.name}！`, "info");
    if (hintsLeft < MAX_HINTS) {
      hintsLeft += 1;
    }
    render();

    setManagedTimeout(() => {
      level += 1;
      currentMonster = HANZI_RADICAL_MONSTERS[(level - 1) % HANZI_RADICAL_MONSTERS.length];
      if (level % 5 === 0) {
        currentMonster = HANZI_RADICAL_MONSTERS[3];
      }
      maxMonsterHp = Math.floor(50 * Math.pow(1.15, level - 1) * currentMonster.hpScale);
      monsterHp = maxMonsterHp;
      playerHp = maxPlayerHp;
      hand = drawHanziRadicalCards([], BASE_HAND_SIZE + (character.handSizeBonus ?? 0), nextId);
      selectedIndices = [];
      hintIndices = [];
      comboResult = null;
      mp = Math.min(10, mp + 2);
      shield = 0;
      turn = "player";
      addLog(`进入第 ${level} 关，遭遇 ${currentMonster.name} (HP: ${maxMonsterHp})`, "info");
      render();
    }, NEXT_MONSTER_DELAY_MS);
  };

  const updateComboResult = (): void => {
    if (selectedIndices.length < 2) {
      comboResult = null;
      return;
    }
    comboResult = getHanziRadicalCombination(selectedIndices.map((index) => hand[index].char));
  };

  const addLog = (text: string, type: HanziRadicalLogType): void => {
    battleLogs = [
      ...battleLogs,
      {
        id: nextId(),
        text,
        type,
        time: new Date().toLocaleTimeString([], { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
      }
    ];
  };

  const addFloatingText = (text: string, type: FloatingTextType, rarity?: FloatingText["rarity"]): void => {
    const id = nextId();
    floatingTexts = [...floatingTexts, { id, text, type, rarity }];
    setManagedTimeout(() => {
      floatingTexts = floatingTexts.filter((item) => item.id !== id);
      render();
    }, FLOATING_TEXT_MS);
  };

  render();

  return {
    destroy(): void {
      clearManagedTimers();
      root.remove();
    }
  };
}

export function findFirstValidHanziRadicalCombo(cards: readonly Pick<BattleCard, "char">[]): number[] | null {
  const cardChars = cards.map((card) => card.char);
  for (let i = 0; i < cardChars.length; i += 1) {
    for (let j = i + 1; j < cardChars.length; j += 1) {
      if (getHanziRadicalCombination([cardChars[i], cardChars[j]])) {
        return [i, j];
      }
    }
  }
  for (let i = 0; i < cardChars.length; i += 1) {
    for (let j = i + 1; j < cardChars.length; j += 1) {
      for (let k = j + 1; k < cardChars.length; k += 1) {
        if (getHanziRadicalCombination([cardChars[i], cardChars[j], cardChars[k]])) {
          return [i, j, k];
        }
      }
    }
  }
  return null;
}

export function countValidHanziRadicalCombos(cards: readonly Pick<BattleCard, "char">[]): number {
  let count = 0;
  const cardChars = cards.map((card) => card.char);
  for (let i = 0; i < cardChars.length; i += 1) {
    for (let j = i + 1; j < cardChars.length; j += 1) {
      if (getHanziRadicalCombination([cardChars[i], cardChars[j]])) {
        count += 1;
      }
    }
  }
  for (let i = 0; i < cardChars.length; i += 1) {
    for (let j = i + 1; j < cardChars.length; j += 1) {
      for (let k = j + 1; k < cardChars.length; k += 1) {
        if (getHanziRadicalCombination([cardChars[i], cardChars[j], cardChars[k]])) {
          count += 1;
        }
      }
    }
  }
  return count;
}

export function calculateHanziRadicalDamage(
  combo: HanziRadicalCombo,
  hero: Pick<HanziRadicalHero, "dmgBonus">,
  monster: Pick<HanziRadicalMonster, "weakness">
): number {
  let damage = combo.power + hero.dmgBonus;
  if (monster.weakness !== "none" && combo.type === monster.weakness) {
    damage = Math.floor(damage * 1.5);
  }
  return damage;
}

export function drawHanziRadicalCards(
  currentHand: readonly Pick<BattleCard, "char">[],
  count: number,
  createId: () => string = () => Math.random().toString(36).slice(2, 11)
): BattleCard[] {
  let attempts = 0;
  let bestHand: BattleCard[] = [];
  let maxCombos = -1;

  while (attempts < 20) {
    const newCards = Array.from({ length: count }, () => createRandomCard(createId));
    const potentialHand = [...currentHand, ...newCards];
    const comboCount = countValidHanziRadicalCombos(potentialHand);
    if (comboCount >= 3) {
      return newCards;
    }
    if (comboCount > maxCombos) {
      maxCombos = comboCount;
      bestHand = newCards;
    }
    attempts += 1;
  }

  const finalHand = [...bestHand];
  let needed = 3 - maxCombos;
  if (needed > 0) {
    const validEntries = HANZI_RADICAL_COMBINATION_ENTRIES.filter((entry) => entry.parts.length === 2 && entry.result);
    for (let index = 0; index < needed; index += 1) {
      if (finalHand.length < 2) {
        break;
      }
      const entry = validEntries[Math.floor(Math.random() * validEntries.length)];
      if (finalHand.length >= 2 + index * 2) {
        const firstIndex = finalHand.length - 1 - index * 2;
        const secondIndex = finalHand.length - 2 - index * 2;
        if (firstIndex >= 0 && secondIndex >= 0) {
          finalHand[secondIndex] = { ...finalHand[secondIndex], char: entry.parts[0] };
          finalHand[firstIndex] = { ...finalHand[firstIndex], char: entry.parts[1] };
        }
      }
    }
  }

  return finalHand;
}

export function getHanziRadicalRarity(type: HanziRadicalCombo["type"]): Rarity {
  if (type === "epic") {
    return "epic";
  }
  if (type === "normal") {
    return "normal";
  }
  return "rare";
}

function createRandomCard(createId: () => string): BattleCard {
  const char = HANZI_RADICAL_DECK[Math.floor(Math.random() * HANZI_RADICAL_DECK.length)];
  return { id: createId(), char };
}

function createScreenTitle(titleText: string, introText: string): HTMLElement {
  const header = document.createElement("header");
  header.className = "hanzi-radical-screen-title";
  const title = document.createElement("h2");
  title.textContent = titleText;
  const intro = document.createElement("p");
  intro.textContent = introText;
  header.append(title, intro);
  return header;
}

function createHeaderButton(label: string, title: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hanzi-radical-header-button";
  button.title = title;
  button.setAttribute("aria-label", title);
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function createLabel(text: string): HTMLElement {
  const label = document.createElement("strong");
  label.className = "hanzi-radical-label";
  label.textContent = text;
  return label;
}

function createHealthFill(current: number, max: number, kind: "monster" | "player"): HTMLElement {
  const track = document.createElement("span");
  track.className = `hanzi-radical-health__track hanzi-radical-health__track--${kind}`;
  const fill = document.createElement("span");
  fill.className = "hanzi-radical-health__fill";
  fill.style.width = `${Math.max(0, Math.min(100, Math.round((current / max) * 100)))}%`;
  track.append(fill);
  return track;
}

function createMpBar(currentMp: number): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "hanzi-radical-mp";
  const safeMp = Math.max(0, Math.min(10, Math.floor(currentMp)));
  bar.setAttribute("aria-label", `墨水 ${safeMp}/10`);
  for (let index = 0; index < 10; index += 1) {
    const pip = document.createElement("span");
    if (index < safeMp) {
      pip.className = "is-filled";
    }
    bar.append(pip);
  }
  return bar;
}

function createModal(titleText: string, onClose: () => void): HTMLElement {
  const overlay = document.createElement("div");
  overlay.className = "hanzi-radical-modal";
  const panel = document.createElement("section");
  panel.className = "hanzi-radical-modal__panel";
  const header = document.createElement("header");
  const title = document.createElement("h3");
  title.textContent = titleText;
  const close = document.createElement("button");
  close.type = "button";
  close.textContent = "×";
  close.setAttribute("aria-label", "关闭");
  close.addEventListener("click", onClose);
  header.append(title, close);
  const body = document.createElement("div");
  body.className = "hanzi-radical-modal__body";
  panel.append(header, body);
  overlay.append(panel);
  return overlay;
}

function createHanziRadicalVisualCard(hint: HanziRadicalVisualHint): HTMLElement {
  const card = document.createElement("div");
  card.className = "hanzi-radical-visual";

  const art = document.createElement("div");
  art.className = "hanzi-radical-visual__art";

  const image = document.createElement("img");
  image.className = "hanzi-radical-visual__image";
  image.src = hint.imageSrc;
  image.alt = hint.imageAlt;
  image.loading = "lazy";
  image.decoding = "async";
  art.append(image);

  const formula = document.createElement("div");
  formula.className = "hanzi-radical-visual__formula";
  appendVisualFormula(formula, hint.formula);

  const label = document.createElement("strong");
  label.className = "hanzi-radical-visual__label";
  label.textContent = hint.label;

  card.append(art, formula, label);

  return card;
}

function appendVisualFormula(target: HTMLElement, formula: readonly string[]): void {
  for (let index = 0; index < formula.length; index += 1) {
    if (index > 0) {
      target.append(document.createTextNode(index === formula.length - 1 ? " = " : " + "));
    }
    const part = document.createElement("span");
    part.textContent = formula[index];
    target.append(part);
  }
}

function getStructureLabel(structure: HanziRadicalStructure): string {
  if (structure === "lr") {
    return "左右";
  }
  if (structure === "tb") {
    return "上下";
  }
  if (structure === "sur") {
    return "包围";
  }
  return "品";
}

function getWeaknessLabel(weakness: HanziRadicalMonster["weakness"]): string {
  if (weakness === "water") {
    return "氵";
  }
  if (weakness === "earth") {
    return "土";
  }
  if (weakness === "mind") {
    return "心";
  }
  return "无";
}

function initAudio(): void {
  const audioWindow = window as Window & {
    webkitAudioContext?: typeof AudioContext;
  };
  const AudioContextCtor = typeof AudioContext === "undefined" ? audioWindow.webkitAudioContext : AudioContext;
  const userActivation = "userActivation" in navigator ? navigator.userActivation : undefined;
  if (!audioContext && userActivation && !userActivation.isActive && !userActivation.hasBeenActive) {
    return;
  }
  if (!audioContext && AudioContextCtor) {
    audioContext = new AudioContextCtor();
  }
  if (audioContext?.state === "suspended") {
    void audioContext.resume();
  }
}

function playBattleSound(type: BattleSound, enabled: boolean): void {
  if (!enabled) {
    return;
  }
  initAudio();
  if (!audioContext) {
    return;
  }

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.connect(gain);
  gain.connect(audioContext.destination);

  if (type === "select") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(400, now);
    oscillator.frequency.exponentialRampToValueAtTime(600, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    oscillator.start(now);
    oscillator.stop(now + 0.1);
  } else if (type === "attack_normal") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === "attack_rare") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } else if (type === "attack_epic") {
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(100, now);
    oscillator.frequency.linearRampToValueAtTime(800, now + 0.5);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6);
    oscillator.start(now);
    oscillator.stop(now + 0.6);
  } else if (type === "crit") {
    oscillator.type = "square";
    oscillator.frequency.setValueAtTime(200, now);
    oscillator.frequency.linearRampToValueAtTime(800, now + 0.1);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  } else if (type === "win") {
    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(440, now);
    oscillator.frequency.setValueAtTime(554, now + 0.1);
    oscillator.frequency.setValueAtTime(659, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.6);
    oscillator.start(now);
    oscillator.stop(now + 0.6);
  } else if (type === "hit") {
    oscillator.type = "sawtooth";
    oscillator.frequency.setValueAtTime(100, now);
    oscillator.frequency.exponentialRampToValueAtTime(0.01, now + 0.2);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === "block") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(150, now);
    oscillator.frequency.linearRampToValueAtTime(100, now + 0.2);
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.2);
    oscillator.start(now);
    oscillator.stop(now + 0.2);
  } else if (type === "heal") {
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(300, now);
    oscillator.frequency.linearRampToValueAtTime(600, now + 0.3);
    gain.gain.setValueAtTime(0.1, now);
    gain.gain.linearRampToValueAtTime(0, now + 0.3);
    oscillator.start(now);
    oscillator.stop(now + 0.3);
  }
}
