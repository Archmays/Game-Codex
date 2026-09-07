export type Glyph = '木' | '林' | '不';
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Tile = 'wall' | 'floor' | 'water' | 'goal' | 'door' | 'wind' | 'rule' | 'socket';
export interface Entity { kind: Glyph; atoms: number; pos: number | null; }
export interface WorldState { player: number; entities: Entity[]; won: boolean; }
export interface Sentence { id: string; subject: '门' | '风'; verb: '开' | '吹'; cells: [number, number, number]; targets: number[]; }
export interface Room {
  id: string; title: string; subtitle: string; arrival: string; departure: string;
  width: number; height: number; tiles: Tile[]; wind: Partial<Record<number, Direction>>;
  sentences: Sentence[]; initial: WorldState; woodAtoms: number; notAtoms: number;
}
type Plan = { title: string; subtitle: string; arrival: string; departure: string; rows: string[]; sentences?: { at: [number, number]; subject: '门' | '风'; negated?: boolean }[] };
const vectors = { '^': 'up', '>': 'right', v: 'down', '<': 'left' } as const;

function room(plan: Plan, index: number): Room {
  const width = plan.rows[0].length, tiles: Tile[] = [], entities: Entity[] = [], wind: Room['wind'] = {};
  let player = -1, nextAtom = 1, woodAtoms = 0, notAtoms = 0;
  for (const [y, row] of plan.rows.entries()) {
    if (row.length !== width) throw new Error(`Unequal row ${index}/${y}`);
    for (const [x, char] of [...row].entries()) {
      const pos = y * width + x;
      tiles.push(char === '#' ? 'wall' : char === '~' ? 'water' : char === 'G' ? 'goal' : char === 'D' ? 'door' : char in vectors ? 'wind' : 'floor');
      if (char in vectors) wind[pos] = vectors[char as keyof typeof vectors];
      if (char === 'P') player = pos;
      if (char === 'w' || char === 'L') {
        const atoms = char === 'w' ? nextAtom : nextAtom | nextAtom * 2;
        nextAtom *= char === 'w' ? 2 : 4; woodAtoms |= atoms;
        entities.push({ kind: char === 'w' ? '木' : '林', atoms, pos });
      }
    }
  }
  const sentences = (plan.sentences ?? []).map((spec, i): Sentence => {
    const first = spec.at[1] * width + spec.at[0], cells: Sentence['cells'] = [first, first + 1, first + 2];
    const targets = tiles.flatMap((tile, pos) => tile === (spec.subject === '门' ? 'door' : 'wind') ? [pos] : []);
    cells.forEach((pos, i) => { tiles[pos] = i === 1 ? 'socket' : 'rule'; });
    if (spec.negated) { entities.push({ kind: '不', atoms: nextAtom, pos: cells[1] }); notAtoms |= nextAtom; nextAtom *= 2; }
    return { id: `r${index + 1}-${i}`, subject: spec.subject, verb: spec.subject === '门' ? '开' : '吹', cells, targets };
  });
  return { id: `r${index + 1}`, ...plan, width, height: plan.rows.length, tiles, wind, sentences, initial: { player, entities, won: false }, woodAtoms, notAtoms };
}

/** Original blockouts. All objects use the same rules; victory is only arrival at G. */
const PLANS: Plan[] = [
  {
    title: '字巷', subtitle: '借一块木，接上断开的路。', arrival: '家在字巷的另一头。先向右走，看看挡路的木。', departure: '木离开了巷口，又托起水上的一步。顺着水声，往前走。',
    rows: ['#######', '#P.w..#', '###.#.#', '#...#.#', '#.###~#', '#..##G#', '#######'],
  },
  {
    title: '借一个不', subtitle: '门和风，只能借到同一个“不”。', arrival: '门不开，风却在吹。墙上的短句和这段路连在一起。', departure: '门开了，风静了。你把一个“不”，借给了更需要它的地方。',
    rows: ['#...###', '#P....#', '#...#D#', '#.....#', '###^###', '#..G..#', '#######'],
    sentences: [{ at: [1, 0], subject: '门', negated: true }, { at: [1, 2], subject: '风' }],
  },
  {
    title: '林里有路', subtitle: '林中的两枚木，各有要去的地方。', arrival: '水路连着两步。林能拆成两枚木，先给它们留出地方。', departure: '一片林，变成两步路。风口到了，这次要把字带得更远。',
    rows: ['#######', '#P.L..#', '#.....#', '###.###', '###~###', '###~###', '#..G..#', '#######'],
  },
  {
    title: '先合再拆', subtitle: '风只送你过去，手里只能带一个字。', arrival: '两枚木都要过风口。风向右吹，过了就走不回来；想好再走，也随时能撤销。', departure: '先合成林，越过风口，再把两枚木借给水。家的灯光已经近了。',
    rows: ['###...#', '#P.#..#', '#w.#..#', '#w.>..#', '#..#..#', '####~##', '####~##', '####G##', '#######'],
    sentences: [{ at: [3, 0], subject: '风' }],
  },
  {
    title: '回家', subtitle: '借风旁的路，或让风安静下来。', arrival: '门后有两条路。可以借“不”让风停下，也可以用木走水路；最后，还要把木带到家前。', departure: '人，终于回到了家。一路借来的字，拼成了你自己的归途。',
    rows: ['#...###', '.P.L..#', '###D###', '#.....#', '##~#^##', '##~#.##', '#...~~G', '#######'],
    sentences: [{ at: [1, 0], subject: '门', negated: true }, { at: [0, 2], subject: '风' }],
  },
];
export const ROOMS: Room[] = PLANS.map(room);
