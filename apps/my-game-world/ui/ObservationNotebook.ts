import { PLAY_SURFACE_MANIFEST, type PlaySurfaceRecord } from "../../../packages/data/playSurfaceManifest";
import {
  OBSERVATION_MAX_RECORDS,
  OBSERVATION_MOMENTS,
  OBSERVATION_NOTE_MAX_CHARS,
  OBSERVATION_RETENTION_DAYS,
  OBSERVATION_TAGS,
  OBSERVED_OUTCOMES,
  PARENT_HELP_VALUES,
  createObservationBundle,
  createObservationExportPreview,
  createObservationRecord,
  deleteAllObservationRecords,
  deleteObservationRecord,
  loadObservationRecords,
  localDateString,
  noteCharacterCount,
  observationBundleFilename,
  saveObservationRecord,
  serializeObservationBundle,
  type NaturalUseObservationRecord,
  type ObservationStorage,
} from "../../../packages/observation/natural-use";

export interface ObservationNotebookHandle { destroy(): void; }

const MOMENT_LABELS: Record<(typeof OBSERVATION_MOMENTS)[number], string> = {
  entry: "刚进入时",
  "first-action": "第一次操作时",
  "during-play": "游戏过程中",
  feedback: "看到反馈时",
  "exit-return": "离开或回来时",
  technical: "出现技术情况时",
  other: "其他时候",
};

const TAG_LABELS: Record<(typeof OBSERVATION_TAGS)[number], string> = {
  "started-without-prompt": "自主开始",
  "asked-to-play-again": "主动说或表示还想玩",
  "replayed-same-activity": "再次选择同一活动",
  "understood-control": "很快找到主要操作",
  hesitated: "明显停顿或寻找操作",
  "needed-light-help": "需要一次轻提示",
  "needed-substantial-help": "需要多次帮助",
  "feedback-unclear": "没有理解当前反馈",
  "control-missed": "没有发现可操作控件",
  "left-before-finish": "未完成就主动离开",
  "technical-glitch": "出现技术问题",
  other: "其他可观察现象",
};

const HELP_LABELS: Record<(typeof PARENT_HELP_VALUES)[number], string> = {
  none: "没有帮助",
  light: "一次轻提示",
  substantial: "多次或较多帮助",
  "not-applicable": "不适用",
};

const OUTCOME_LABELS: Record<(typeof OBSERVED_OUTCOMES)[number], string> = {
  continued: "继续玩",
  replayed: "再次选择",
  stopped: "停下或离开",
  blocked: "被问题挡住",
  "not-applicable": "不适用",
};

function buildCommit(): string {
  const value = document.documentElement.dataset.buildCommit ?? "local-source";
  return /^[a-f0-9]{40}$/.test(value) ? value : "local-source";
}

function surfaceGroup(surface: PlaySurfaceRecord): string {
  if (surface.kind === "classic-hub" || surface.kind === "classic-entry") return "游戏百宝箱（Classic）";
  if (surface.productId === "hanzi-radical-battle") return "墨迹森林";
  if (surface.productId === "math-lab") return "数学世界";
  if (surface.productId === "english-spell-battle") return "英语世界";
  return "我的游戏世界";
}

function downloadJson(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.hidden = true;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 0);
}

function selectableElements(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>("button:not([disabled]):not([hidden]), input:not([disabled]):not([hidden]), select:not([disabled]):not([hidden]), textarea:not([disabled]):not([hidden]), summary, a[href]")]
    .filter((element) => element.getClientRects().length > 0);
}

export function mountObservationNotebook(
  root: HTMLElement,
  storage: ObservationStorage = window.localStorage,
): ObservationNotebookHandle {
  let destroyed = false;
  let records: NaturalUseObservationRecord[] = [];
  let showAll = false;
  let previewReturnFocus: HTMLElement | null = null;

  root.innerHTML = `<section class="observation-notebook" aria-labelledby="observation-title" data-testid="observation-notebook">
    <header><p>家长角 · 本机主动笔记</p><h3 id="observation-title">使用观察笔记</h3></header>
    <p class="observation-notebook__privacy">只有你按下“保存这条观察”时才记录。不会自动跟踪孩子怎么玩，也不会上传。</p>
    <div class="observation-notebook__actions" aria-label="观察笔记操作">
      <button type="button" data-observation-show-form>记录一条</button>
      <button type="button" data-observation-show-list>查看已有记录</button>
      <button type="button" data-observation-export-preview>导出</button>
      <button type="button" data-observation-delete-all>删除全部</button>
    </div>
    <p class="observation-notebook__status" role="status" aria-live="polite" data-observation-status>默认不记录。记录最多保留 ${OBSERVATION_RETENTION_DAYS} 天、${OBSERVATION_MAX_RECORDS} 条。</p>
    <section data-observation-form-section aria-labelledby="observation-form-title">
      <h4 id="observation-form-title">记录一条实际发生的现象</h4>
      <form data-observation-form novalidate>
        <label><span>1. 在哪里看到</span><select required data-observation-surface><option value="">请选择（不会自动读取当前页面）</option></select></label>
        <label><span>观察日期</span><input type="date" required data-observation-date /></label>
        <label><span>2. 发生在什么时候</span><select required data-observation-moment></select></label>
        <fieldset><legend>3. 观察到的现象（选 1–3 个）</legend><div class="observation-notebook__choices" data-observation-tags></div></fieldset>
        <fieldset><legend>4. 家长是否帮助</legend><div class="observation-notebook__choices" data-observation-help></div></fieldset>
        <fieldset><legend>5. 后来怎么样</legend><div class="observation-notebook__choices" data-observation-outcome></div></fieldset>
        <label><span>6. 可选备注</span><textarea rows="3" data-observation-note aria-describedby="observation-note-help observation-note-count"></textarea></label>
        <p id="observation-note-help">只写发生了什么。不要写姓名、学校、班级、联系方式、健康或其他私人信息。</p>
        <p id="observation-note-count" data-observation-note-count>0 / ${OBSERVATION_NOTE_MAX_CHARS}</p>
        <p class="observation-notebook__error" role="alert" aria-live="assertive" data-observation-error></p>
        <button type="submit" data-observation-save>保存这条观察</button>
      </form>
    </section>
    <section hidden data-observation-list-section aria-labelledby="observation-list-title">
      <h4 id="observation-list-title">已有记录</h4>
      <p data-observation-list-summary></p>
      <ol class="observation-notebook__records" data-observation-records></ol>
      <button type="button" hidden data-observation-show-all>展开全部</button>
    </section>
    <div class="observation-preview-layer" hidden data-observation-preview-layer>
      <section class="observation-preview" role="dialog" aria-modal="true" aria-labelledby="observation-preview-title" aria-describedby="observation-preview-description" data-testid="observation-export-preview">
        <h4 id="observation-preview-title">导出前隐私预览</h4>
        <p id="observation-preview-description">请确认这份文件只包含你主动保存的观察。</p>
        <dl>
          <div><dt>记录条数</dt><dd data-preview-count></dd></div>
          <div><dt>最早 / 最晚日期</dt><dd data-preview-dates></dd></div>
          <div><dt>涉及 surface</dt><dd data-preview-surfaces></dd></div>
          <div><dt>含备注条数</dt><dd data-preview-notes></dd></div>
        </dl>
        <p>不会包含游戏存档、整个 localStorage、route/history、session、点击、精确孩子使用时间、浏览器资料、设备信息、IP、音视频或屏幕内容。</p>
        <div class="observation-preview__actions">
          <button type="button" data-observation-confirm-export>确认导出</button>
          <button type="button" data-observation-cancel-export>取消</button>
        </div>
      </section>
    </div>
  </section>`;

  const formSection = root.querySelector<HTMLElement>("[data-observation-form-section]")!;
  const listSection = root.querySelector<HTMLElement>("[data-observation-list-section]")!;
  const form = root.querySelector<HTMLFormElement>("[data-observation-form]")!;
  const surfaceSelect = root.querySelector<HTMLSelectElement>("[data-observation-surface]")!;
  const dateInput = root.querySelector<HTMLInputElement>("[data-observation-date]")!;
  const momentSelect = root.querySelector<HTMLSelectElement>("[data-observation-moment]")!;
  const noteInput = root.querySelector<HTMLTextAreaElement>("[data-observation-note]")!;
  const noteCount = root.querySelector<HTMLElement>("[data-observation-note-count]")!;
  const error = root.querySelector<HTMLElement>("[data-observation-error]")!;
  const status = root.querySelector<HTMLElement>("[data-observation-status]")!;
  const previewLayer = root.querySelector<HTMLElement>("[data-observation-preview-layer]")!;

  const groups = new Map<string, HTMLOptGroupElement>();
  for (const surface of PLAY_SURFACE_MANIFEST) {
    const label = surfaceGroup(surface);
    const group = groups.get(label) ?? Object.assign(document.createElement("optgroup"), { label });
    groups.set(label, group);
    const option = document.createElement("option");
    option.value = surface.id;
    option.textContent = surface.title;
    group.append(option);
  }
  surfaceSelect.append(...groups.values());
  for (const moment of OBSERVATION_MOMENTS) momentSelect.add(new Option(MOMENT_LABELS[moment], moment, false, moment === "during-play"));

  const addChoices = (selector: string, name: string, values: readonly string[], labels: Record<string, string>, checked: string): void => {
    const host = root.querySelector<HTMLElement>(selector)!;
    for (const value of values) {
      const label = document.createElement("label");
      const input = document.createElement("input");
      input.type = name === "observation-tags" ? "checkbox" : "radio";
      input.name = name;
      input.value = value;
      input.checked = value === checked;
      const text = document.createElement("span");
      text.textContent = labels[value];
      label.append(input, text);
      host.append(label);
    }
  };
  addChoices("[data-observation-tags]", "observation-tags", OBSERVATION_TAGS, TAG_LABELS, "");
  addChoices("[data-observation-help]", "observation-help", PARENT_HELP_VALUES, HELP_LABELS, "none");
  addChoices("[data-observation-outcome]", "observation-outcome", OBSERVED_OUTCOMES, OUTCOME_LABELS, "continued");

  const today = localDateString();
  dateInput.value = today;
  dateInput.max = today;

  const showStatusError = (message: string): void => { error.textContent = message; status.textContent = "这次没有保存；已有记录没有改变。"; };
  try { records = loadObservationRecords(storage, today); } catch (loadError) { showStatusError(loadError instanceof Error ? loadError.message : "本机观察笔记无法读取。"); }

  const renderList = (): void => {
    const list = root.querySelector<HTMLOListElement>("[data-observation-records]")!;
    const summary = root.querySelector<HTMLElement>("[data-observation-list-summary]")!;
    const showAllButton = root.querySelector<HTMLButtonElement>("[data-observation-show-all]")!;
    list.replaceChildren();
    const newest = [...records].reverse();
    const visible = showAll ? newest : newest.slice(0, 10);
    summary.textContent = records.length ? `共 ${records.length} 条；默认显示最近 ${Math.min(10, records.length)} 条。` : "还没有主动保存的观察。";
    for (const record of visible) {
      const item = document.createElement("li");
      const heading = document.createElement("p");
      heading.textContent = `${record.dateLocal} · ${PLAY_SURFACE_MANIFEST.find((surface) => surface.id === record.surfaceId)?.title ?? record.surfaceId}`;
      const tags = document.createElement("p");
      tags.textContent = record.tags.map((tag) => TAG_LABELS[tag]).join("；");
      item.append(heading, tags);
      if (record.note) {
        const note = document.createElement("p");
        note.className = "observation-notebook__record-note";
        note.textContent = record.note;
        item.append(note);
      }
      const remove = document.createElement("button");
      remove.type = "button";
      remove.textContent = "删除这条";
      remove.dataset.observationDelete = record.id;
      item.append(remove);
      list.append(item);
    }
    showAllButton.hidden = records.length <= 10;
    showAllButton.textContent = showAll ? "只看最近 10 条" : `展开全部 ${records.length} 条`;
  };
  renderList();

  const showForm = (): void => {
    listSection.hidden = true;
    formSection.hidden = false;
    surfaceSelect.focus();
  };
  const showList = (): void => {
    formSection.hidden = true;
    listSection.hidden = false;
    renderList();
    listSection.querySelector<HTMLElement>("button, h4")?.focus();
  };

  root.querySelector("[data-observation-show-form]")?.addEventListener("click", showForm);
  root.querySelector("[data-observation-show-list]")?.addEventListener("click", showList);
  root.querySelector("[data-observation-show-all]")?.addEventListener("click", () => { showAll = !showAll; renderList(); });
  noteInput.addEventListener("input", () => {
    const count = noteCharacterCount(noteInput.value);
    noteCount.textContent = `${count} / ${OBSERVATION_NOTE_MAX_CHARS}`;
    noteCount.dataset.overLimit = String(count > OBSERVATION_NOTE_MAX_CHARS);
  });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    error.textContent = "";
    const tags = [...form.querySelectorAll<HTMLInputElement>('input[name="observation-tags"]:checked')].map((input) => input.value) as (typeof OBSERVATION_TAGS)[number][];
    const help = form.querySelector<HTMLInputElement>('input[name="observation-help"]:checked')?.value as (typeof PARENT_HELP_VALUES)[number] | undefined;
    const outcome = form.querySelector<HTMLInputElement>('input[name="observation-outcome"]:checked')?.value as (typeof OBSERVED_OUTCOMES)[number] | undefined;
    if (!surfaceSelect.value) { showStatusError("请手工选择在哪里看到；工具不会自动读取当前页面。"); surfaceSelect.focus(); return; }
    if (tags.length < 1 || tags.length > 3) { showStatusError("请选择 1–3 个可观察现象。"); form.querySelector<HTMLInputElement>('input[name="observation-tags"]')?.focus(); return; }
    if (!help || !outcome) { showStatusError("请选择家长帮助和后来怎么样。"); return; }
    try {
      const record = createObservationRecord({
        dateLocal: dateInput.value,
        buildCommit: buildCommit(),
        surfaceId: surfaceSelect.value,
        moment: momentSelect.value as (typeof OBSERVATION_MOMENTS)[number],
        tags,
        parentHelp: help,
        outcome,
        note: noteInput.value,
      }, { today });
      records = saveObservationRecord(storage, record, today);
      form.querySelectorAll<HTMLInputElement>('input[name="observation-tags"]:checked').forEach((input) => { input.checked = false; });
      noteInput.value = "";
      noteCount.textContent = `0 / ${OBSERVATION_NOTE_MAX_CHARS}`;
      status.textContent = `已在本机保存 1 条观察；现在共有 ${records.length} 条。`;
      renderList();
    } catch (saveError) {
      showStatusError(saveError instanceof Error ? saveError.message : "这条观察没有保存。");
    }
  });

  root.querySelector("[data-observation-records]")?.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-observation-delete]");
    if (!button || destroyed) return;
    if (!window.confirm("只删除这一条家长观察笔记？不会删除任何游戏进度。")) return;
    try {
      records = deleteObservationRecord(storage, button.dataset.observationDelete ?? "", today);
      status.textContent = "已删除这条观察；游戏进度没有改变。";
      renderList();
    } catch (deleteError) { showStatusError(deleteError instanceof Error ? deleteError.message : "这条观察没有删除。"); }
  });

  root.querySelector("[data-observation-delete-all]")?.addEventListener("click", () => {
    if (!window.confirm("删除全部家长观察笔记？这只删除观察 key，不会删除任何游戏存档。")) return;
    try {
      deleteAllObservationRecords(storage);
      records = [];
      status.textContent = "已删除全部观察笔记；游戏进度没有改变。";
      renderList();
    } catch (deleteError) { showStatusError(deleteError instanceof Error ? deleteError.message : "观察笔记没有删除。"); }
  });

  const closePreview = (): void => {
    previewLayer.hidden = true;
    previewReturnFocus?.focus();
    previewReturnFocus = null;
  };

  root.querySelector<HTMLButtonElement>("[data-observation-export-preview]")?.addEventListener("click", (event) => {
    try {
      records = loadObservationRecords(storage, today);
      const preview = createObservationExportPreview(records);
      root.querySelector<HTMLElement>("[data-preview-count]")!.textContent = String(preview.recordCount);
      root.querySelector<HTMLElement>("[data-preview-dates]")!.textContent = preview.earliestDate ? `${preview.earliestDate} / ${preview.latestDate}` : "无";
      root.querySelector<HTMLElement>("[data-preview-surfaces]")!.textContent = String(preview.distinctSurfaces);
      root.querySelector<HTMLElement>("[data-preview-notes]")!.textContent = String(preview.optionalNoteCount);
      previewReturnFocus = event.currentTarget as HTMLElement;
      previewLayer.hidden = false;
      root.querySelector<HTMLButtonElement>("[data-observation-confirm-export]")?.focus();
    } catch (exportError) { showStatusError(exportError instanceof Error ? exportError.message : "导出预览没有打开。"); }
  });
  root.querySelector("[data-observation-cancel-export]")?.addEventListener("click", closePreview);
  root.querySelector<HTMLButtonElement>("[data-observation-confirm-export]")?.addEventListener("click", async (event) => {
    const button = event.currentTarget as HTMLButtonElement;
    button.disabled = true;
    try {
      records = loadObservationRecords(storage, today);
      const bundle = await createObservationBundle(records, buildCommit());
      downloadJson(serializeObservationBundle(bundle), observationBundleFilename());
      status.textContent = `已导出 ${bundle.recordCount} 条主动观察；records SHA-256 ${bundle.integrity.recordsSha256.slice(0, 12)}…。`;
      closePreview();
    } catch (exportError) { showStatusError(exportError instanceof Error ? exportError.message : "这次没有生成导出文件。"); }
    finally { button.disabled = false; }
  });

  const keydown = (event: KeyboardEvent): void => {
    if (previewLayer.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      closePreview();
      return;
    }
    if (event.key !== "Tab") return;
    const controls = selectableElements(previewLayer);
    if (!controls.length) return;
    const first = controls[0];
    const last = controls.at(-1)!;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); event.stopPropagation(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); event.stopPropagation(); first.focus(); }
  };
  root.addEventListener("keydown", keydown);

  return {
    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      root.removeEventListener("keydown", keydown);
      root.replaceChildren();
    },
  };
}
