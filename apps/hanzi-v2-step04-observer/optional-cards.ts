import {
  AGAIN_AGAIN_VALUES,
  FAVORITE_MOMENT_VALUES,
  type AgainAgainValue,
  type FavoriteMomentValue,
} from "./observation-model";

export const AGAIN_AGAIN_OPTIONS: readonly { readonly value: AgainAgainValue; readonly label: string }[] = [
  { value: "AGAIN_NOW", label: "还想马上再玩" },
  { value: "MAYBE_LATER", label: "下次再玩" },
  { value: "STOP", label: "先不玩了" },
  { value: "DECLINED", label: "不想回答" },
  { value: "NOT_ASKED", label: "未展示" },
];

export const FAVORITE_MOMENT_OPTIONS: readonly { readonly value: FavoriteMomentValue; readonly label: string; readonly motif: string }[] = [
  { value: "CAMP", label: "营地", motif: "camp" },
  { value: "HANZI_MAGIC", label: "汉字魔法", motif: "magic" },
  { value: "THREE_CHOICE", label: "三选一", motif: "choice" },
  { value: "BOSS", label: "Boss", motif: "boss" },
  { value: "SPELLBOOK", label: "魔法书", motif: "book" },
  { value: "NO_SELECTION", label: "不选择", motif: "none" },
  { value: "NOT_ASKED", label: "未展示", motif: "none" },
];

export function isAgainAgainValue(value: unknown): value is AgainAgainValue {
  return typeof value === "string" && AGAIN_AGAIN_VALUES.includes(value as AgainAgainValue);
}

export function isFavoriteMomentValue(value: unknown): value is FavoriteMomentValue {
  return typeof value === "string" && FAVORITE_MOMENT_VALUES.includes(value as FavoriteMomentValue);
}

export function optionalCardsMarkup(selected: {
  readonly againAgain: AgainAgainValue;
  readonly favoriteMoment: FavoriteMomentValue;
}): string {
  return `<section class="step04-optional" data-testid="step04-optional-cards">
    <div class="step04-section-heading"><div><span>结束或停止后 · 可跳过</span><h2>可选儿童选择</h2></div><strong class="step04-local-chip">不评分</strong></div>
    <p>只有家长判断合适时才展示。孩子可以拒绝；“马上再玩”不等于学习，“先不玩了”也不等于失败。</p>
    <fieldset><legend>Again-Again</legend><div class="step04-option-row">${AGAIN_AGAIN_OPTIONS.map((option) => `
      <button type="button" data-again-again="${option.value}" aria-pressed="${selected.againAgain === option.value}">${option.label}</button>`).join("")}</div></fieldset>
    <fieldset><legend>最想再看哪一段？</legend><div class="step04-moment-grid">${FAVORITE_MOMENT_OPTIONS.map((option) => `
      <button type="button" class="step04-moment" data-favorite-moment="${option.value}" aria-pressed="${selected.favoriteMoment === option.value}">
        <span class="step04-moment__art step04-moment__art--${option.motif}" aria-hidden="true"></span><strong>${option.label}</strong>
      </button>`).join("")}</div></fieldset>
    <div class="step04-optional-questions"><strong>结束后仅可选问两句，孩子可以不回答：</strong><p>“你最想再看哪一段？”</p><p>“有没有哪一处让你不知道发生了什么或不舒服？”</p></div>
  </section>`;
}
