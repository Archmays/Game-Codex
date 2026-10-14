// Qualitative teaching model. No coefficient is a measured pencil specification.
export function createPaper(size = 256) { return Array(size).fill(0); }
export function deposit(marks, from, to, settings, erase = false) {
  const lo = Math.max(0, Math.min(1, Math.min(from, to)));
  const hi = Math.max(0, Math.min(1, Math.max(from, to)));
  const density = { '2H': .29, HB: .92, '2B': -Math.log(.15) }[settings.grade];
  const pressure = [.55, 1, 1.7][settings.pressure];
  const paper = { smooth: .65, ordinary: 1, rough: 1.35 }[settings.paper];
  let removed = 0;
  for (let i = Math.floor(lo * marks.length); i < Math.min(marks.length, Math.ceil(hi * marks.length)); i++) {
    // Integrate length inside this bin. Splitting motion into frames leaves the same result.
    const distance = Math.max(0, Math.min(hi, (i + 1) / marks.length) - Math.max(lo, i / marks.length)) * marks.length;
    const before = marks[i];
    marks[i] = erase ? before * Math.exp(-1.65 * distance) : 1 - (1 - before) * Math.exp(-density * pressure * paper * distance);
    removed += erase ? before - marks[i] : 0;
  }
  return { removed };
}
