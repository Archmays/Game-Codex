import test from 'node:test';
import assert from 'node:assert/strict';
import { createPaper, deposit } from '../public/structure-explorer/pencil-model.js';

const defaults = { grade: 'HB', pressure: 1, paper: 'ordinary' };
const total = marks => marks.reduce((sum, value) => sum + value, 0);
function pass(options = defaults, subdivisions = 1, backwards = false, erase = false, marks = createPaper()) {
  for (let i = 0; i < subdivisions; i++) {
    const from = i / subdivisions;
    const to = (i + 1) / subdivisions;
    deposit(marks, backwards ? 1 - from : from, backwards ? 1 - to : to, options, erase);
  }
  return marks;
}
function closePapers(actual, expected) {
  assert.equal(actual.length, expected.length);
  for (let i = 0; i < actual.length; i++) {
    assert.ok(Math.abs(actual[i] - expected[i]) <= 1e-8, `Bin ${i}: ${actual[i]} differs from ${expected[i]}`);
  }
}

test('paper is fresh, independently allocated and starts blank', () => {
  const paper = createPaper();
  assert.equal(paper.length, 256);
  assert.ok(paper.every(value => value === 0));
  const smaller = createPaper(37);
  assert.equal(smaller.length, 37);
  deposit(paper, .1, .8, defaults);
  assert.ok(total(paper) > 0);
  assert.ok(smaller.every(value => value === 0));
  assert.ok(createPaper().every(value => value === 0));
});

test('equal path gives equal ink across frame subdivisions and directions', () => {
  for (const grade of ['2H', 'HB', '2B']) {
    const options = { ...defaults, grade };
    const whole = pass(options);
    for (const count of [7, 60, 144, 997]) closePapers(pass(options, count), whole);
    closePapers(pass(options, 73, true), whole);
    // Partial travel uses fractional bin overlap, including non-bin-aligned endpoints.
    const partial = createPaper();
    deposit(partial, .137, .823, options);
    const frames = createPaper();
    for (let i = 0; i < 61; i++) deposit(frames, .137 + .686 * i / 61, .137 + .686 * (i + 1) / 61, options);
    closePapers(frames, partial);
  }
});

test('grade, pressure, paper and repeated passes change deposit independently', () => {
  const grade = ['2H', 'HB', '2B'].map(grade => total(pass({ ...defaults, grade })));
  assert.ok(grade[0] < grade[1] && grade[1] < grade[2]);
  for (const value of grade) assert.ok(value / 256 >= .2 - 1e-8 && value / 256 <= .85 + 1e-8);
  const pressure = [0, 1, 2].map(pressure => total(pass({ ...defaults, pressure })));
  assert.ok(pressure[0] < pressure[1] && pressure[1] < pressure[2]);
  const paper = ['smooth', 'ordinary', 'rough'].map(paper => total(pass({ ...defaults, paper })));
  assert.ok(paper[0] < paper[1] && paper[1] < paper[2]);
  const repeated = pass();
  const once = total(repeated);
  pass(defaults, 47, true, false, repeated);
  assert.ok(total(repeated) > once);
  for (let i = 0; i < 30; i++) pass(defaults, 13, false, false, repeated);
  assert.ok(repeated.every(value => Number.isFinite(value) && value >= 0 && value <= 1));
});

test('stationary tools do not deposit, and settings are not mutated', () => {
  const options = Object.freeze({ ...defaults });
  const marks = createPaper();
  deposit(marks, .48, .48, options);
  assert.equal(total(marks), 0);
  deposit(marks, .2, .7, options);
  assert.deepEqual(options, defaults);
});

test('erasing conserves removed ink, never creates marks, and is frame independent', () => {
  const blank = createPaper();
  assert.equal(deposit(blank, 0, 1, defaults, true).removed, 0);
  assert.ok(blank.every(value => value === 0));
  const original = pass();
  const once = [...original];
  const removed = deposit(once, .127, .871, defaults, true).removed;
  assert.ok(removed > 0);
  assert.ok(Math.abs(removed - (total(original) - total(once))) <= 1e-8);
  assert.ok(once.every((value, i) => value >= 0 && value <= original[i]));
  const frames = [...original];
  for (let i = 0; i < 83; i++) deposit(frames, .127 + .744 * i / 83, .127 + .744 * (i + 1) / 83, defaults, true);
  closePapers(frames, once);
  for (let i = 0; i < 100; i++) pass(defaults, 7, false, true, once);
  assert.ok(once.every(value => Number.isFinite(value) && value >= 0));
  assert.ok(total(once) < total(original));
});
