import {
  clampArrayFactor,
  createArrayModel,
  createArrayTask,
  transposeArray,
} from "../games/multiplication-adventure/model";

describe("Math World array model", () => {
  it("covers all 81 multiplication facts with exact cells and labels", () => {
    for (let rows = 1; rows <= 9; rows += 1) {
      for (let columns = 1; columns <= 9; columns += 1) {
        const model = createArrayModel(rows, columns);
        expect(model.product).toBe(rows * columns);
        expect(model.cellIds).toHaveLength(rows * columns);
        expect(new Set(model.cellIds).size).toBe(rows * columns);
        expect(model.expression).toBe(`${rows} × ${columns} = ${rows * columns}`);
        expect(model.rowText).toBe(`${rows} 行，每行 ${columns} 个，共 ${rows * columns} 个`);
        expect(model.columnText).toBe(`${columns} 列，每列 ${rows} 个，共 ${rows * columns} 个`);
      }
    }
  });

  it("transposes direction while preserving the product and every cell", () => {
    for (let rows = 1; rows <= 9; rows += 1) {
      for (let columns = 1; columns <= 9; columns += 1) {
        const before = createArrayModel(rows, columns);
        const after = transposeArray(before);
        expect(after.rows).toBe(columns);
        expect(after.columns).toBe(rows);
        expect(after.product).toBe(before.product);
        expect(after.cellIds).toHaveLength(before.cellIds.length);
      }
    }
  });

  it("keeps dimensions in the published 1..9 range", () => {
    expect(clampArrayFactor(-1)).toBe(1);
    expect(clampArrayFactor(12)).toBe(9);
    expect(clampArrayFactor(Number.NaN)).toBe(1);
  });

  it("generates deterministic tasks without square transpose no-ops", () => {
    for (const mode of ["build", "read", "transpose"] as const) {
      for (let index = 0; index < 120; index += 1) {
        const task = createArrayTask("repeatable", index, mode);
        expect(createArrayTask("repeatable", index, mode)).toEqual(task);
        expect(task.rows).toBeGreaterThanOrEqual(1);
        expect(task.rows).toBeLessThanOrEqual(9);
        expect(task.columns).toBeGreaterThanOrEqual(1);
        expect(task.columns).toBeLessThanOrEqual(9);
        if (mode === "transpose") expect(task.rows).not.toBe(task.columns);
      }
    }
  });
});
