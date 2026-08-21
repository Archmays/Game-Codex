export type ArrayWorkshopMode = "build" | "read" | "transpose";

export interface ArrayModel {
  readonly rows: number;
  readonly columns: number;
  readonly product: number;
  readonly expression: string;
  readonly rowText: string;
  readonly columnText: string;
  readonly cellIds: readonly string[];
}

export interface ArrayTask {
  readonly seed: string;
  readonly index: number;
  readonly mode: ArrayWorkshopMode;
  readonly rows: number;
  readonly columns: number;
}

export function clampArrayFactor(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(9, Math.max(1, Math.round(value)));
}

export function createArrayModel(rowsValue: number, columnsValue: number): ArrayModel {
  const rows = clampArrayFactor(rowsValue);
  const columns = clampArrayFactor(columnsValue);
  const product = rows * columns;
  return {
    rows,
    columns,
    product,
    expression: `${rows} × ${columns} = ${product}`,
    rowText: `${rows} 行，每行 ${columns} 个，共 ${product} 个`,
    columnText: `${columns} 列，每列 ${rows} 个，共 ${product} 个`,
    cellIds: Array.from({ length: product }, (_, index) => `r${Math.floor(index / columns) + 1}-c${index % columns + 1}`),
  };
}

export function transposeArray(model: Pick<ArrayModel, "rows" | "columns">): ArrayModel {
  return createArrayModel(model.columns, model.rows);
}

export function createArrayTask(seed: string, index: number, mode: ArrayWorkshopMode): ArrayTask {
  const normalizedIndex = Math.max(0, Math.floor(index));
  const hash = hashString(`${seed}:${mode}:${normalizedIndex}`);
  const rows = hash % 9 + 1;
  let columns = Math.floor(hash / 9) % 9 + 1;
  if (mode === "transpose" && rows === columns) columns = columns === 9 ? 8 : columns + 1;
  return { seed, index: normalizedIndex, mode, rows, columns };
}

export function getNumberBlockCount(value: number): number {
  return Math.max(0, Math.floor(value));
}

export function getMultiplicationGridCount(a: number, b: number): number {
  return Math.max(0, Math.floor(a) * Math.floor(b));
}

function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}
