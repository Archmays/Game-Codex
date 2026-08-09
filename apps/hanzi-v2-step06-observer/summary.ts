import type { Step06ObservationDocument } from "./observation-model";

export function renderStep06FixtureSummary(observation: Step06ObservationDocument): string {
  const d = observation.derivedActions;
  const treasureOpened = observation.technicalEvents.some((event) => event.eventType === "world_destination_opened" && event.safeMetadata.destinationId === "TREASURE_BOX");
  return `<section class="step06-summary" data-testid="step06-summary-fixture">
    <h2>观察记录摘要</h2>
    <p><strong>证据类型：</strong>${observation.evidenceKind}</p>
    <h3>技术事实</h3>
    <dl><dt>固定地址</dt><dd>${observation.sessionIdentity.canonicalOrigin}</dd><dt>进度连续</dt><dd>${observation.progressContinuity.completedAndComplete ? "是" : "否"}</dd><dt>第一次动作</dt><dd>${d.firstWorldActionMs ?? "未记录"}</dd><dt>第一次去向</dt><dd>${d.firstDestination ?? "未记录"}</dd><dt>进入森林</dt><dd>${d.forestEntered ? "是" : "否"}</dd><dt>打开字灵书</dt><dd>${d.worldSpellbookOpened ? "是" : "否"}</dd><dt>选择百宝箱</dt><dd>${treasureOpened ? "是" : "否"}</dd><dt>完整一局</dt><dd>${d.goldenRunCompleted ? "是" : "否"}</dd><dt>回到世界</dt><dd>${d.returnedToWorld ? "是" : "否"}</dd></dl>
    <h3>人工观察</h3><p>世界识别、干预、投入和身心感受保留为家长记录，不由技术事件代填。</p>
    <h3>明确不作结论</h3><p>不据此判断长期投入、学习效果、保持度、剩余 8 字、完整墨迹森林或正式美术偏好。</p>
  </section>`;
}
