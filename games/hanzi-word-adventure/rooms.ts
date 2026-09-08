export type Glyph = '木' | '林' | '不' | '日' | '月' | '明';
export const CHAPTERS = [{ id: 'homeward', title: '借字归途', firstRoom: 0 }, { id: 'lamplight', title: '借一盏明', firstRoom: 5 }, { id: 'confluence', title: '光与归途', firstRoom: 10 }] as const;
export type ChapterId = typeof CHAPTERS[number]['id'];
export type Direction = 'up' | 'right' | 'down' | 'left';
export type Tile = 'wall' | 'floor' | 'water' | 'goal' | 'door' | 'wind' | 'rule' | 'socket' | 'shadow';
export interface Entity { kind: Glyph; atoms: number; pos: number | null; }
export interface WorldState { player: number; entities: Entity[]; won: boolean; }
export interface Sentence { id: string; subject: '门' | '风'; verb: '开' | '吹'; cells: [number, number, number]; targets: number[]; }
export interface Room {
  id: string; chapterId: ChapterId; title: string; subtitle: string; arrival: string; departure: string;
  width: number; height: number; tiles: Tile[]; wind: Partial<Record<number, Direction>>;
  sentences: Sentence[]; initial: WorldState; woodAtoms: number; notAtoms: number; sunAtoms: number; moonAtoms: number; lightRadius: number;
}
type Plan = { id?: string; title: string; subtitle: string; arrival: string; departure: string; rows: string[]; sentences?: { at: [number, number]; subject: '门' | '风'; negated?: boolean }[] };
const vectors = { '^': 'up', '>': 'right', v: 'down', '<': 'left' } as const;

function room(plan: Plan, index: number): Room {
  const width = plan.rows[0].length, tiles: Tile[] = [], entities: Entity[] = [], wind: Room['wind'] = {};
  let player = -1, nextAtom = 1, woodAtoms = 0, notAtoms = 0, sunAtoms = 0, moonAtoms = 0;
  for (const [y, row] of plan.rows.entries()) {
    if (row.length !== width) throw new Error(`Unequal row ${index}/${y}`);
    for (const [x, char] of [...row].entries()) {
      const pos = y * width + x;
      tiles.push(char === '#' ? 'wall' : char === '?' ? 'shadow' : char === '~' ? 'water' : char === 'G' ? 'goal' : char === 'D' ? 'door' : char in vectors ? 'wind' : 'floor');
      if (char in vectors) wind[pos] = vectors[char as keyof typeof vectors];
      if (char === 'P') player = pos;
      if (char === 'n') { entities.push({ kind:'不', atoms:nextAtom, pos }); notAtoms |= nextAtom; nextAtom *= 2; }
      if (char === 's' || char === 'm' || char === 'B') {
        const atoms = char === 'B' ? nextAtom | nextAtom * 2 : nextAtom;
        if (char !== 'm') sunAtoms |= nextAtom;
        if (char !== 's') moonAtoms |= char === 'B' ? nextAtom * 2 : nextAtom;
        entities.push({ kind: char === 's' ? '日' : char === 'm' ? '月' : '明', atoms, pos }); nextAtom *= char === 'B' ? 4 : 2;
      }
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
  return { ...plan, id: plan.id ?? `r${index + 1}`, chapterId: CHAPTERS[Math.floor(index / 5)].id, width, height: plan.rows.length, tiles, wind, sentences, initial: { player, entities, won: false }, woodAtoms, notAtoms, sunAtoms, moonAtoms, lightRadius: 3 };
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
const LIGHT_PLANS: Plan[] = [
  { id: 'light-1', title: '合一盏明', subtitle: '日与月是材料；只有明能照开影路。', arrival: '日和月都不发出路光。把它们合成明，带着一盏明过影路。', departure: '日月合成明，影格有了清楚的路。', rows: ['#######', '#Psm..#', '#####?#', '#####?#', '#####G#', '#######'] },
  { id: 'light-2', title: '放灯腾手', subtitle: '放下明，空出手来借木搭桥。', arrival: '明和木不能一起拿。先选一块岸放灯，让影路留在三步光中。', departure: '手空出来了，明还在照路。', rows: ['#######', '#PBw..#', '#####?#', '#####~#', '#####G#', '#######'] },
  { id: 'light-3', title: '隔岸搬桥', subtitle: '先把灯送到岸边，再搬木走水路。', arrival: '影路隔开了两岸。把灯安在合适的地方，来回搬木。', departure: '灯的位置连起了来回的路。', rows: ['#######', '#PB...#', '###?###', '#w...##', '###~###', '###G###', '#######'] },
  { id: 'light-4', title: '收回光源', subtitle: '两段影路之间，灯也要跟你走。', arrival: '一盏明只照三步。走过第一段后，回身收灯，再去更远的影路。', departure: '灯没有留在身后，它也抵达了前路。', rows: ['#######', '#P.Bw.#', '###?###', '###~###', '###.###', '###?###', '###?G##', '#######'] },
  { id: 'light-5', title: '两岸借光', subtitle: '带灯探路，放灯借木，最后把灯带走。', arrival: '水和影交错。每次放灯，都看看下一步和回头路是否仍然亮着。', departure: '一盏明与一枚木，接好了两岸。', rows: ['#######', '#Psmw.#', '#.....#', '###?###', '###~###', '#.....#', '#####?#', '#####G#', '#######'] },
];
const WOVEN_PLANS: Plan[] = [
  { id: 'woven-1', title: '林边灯台', subtitle: '让灯留在岸上，林中的木去架桥。', arrival: '先搬明，再拆林。三步光可以照到桥边，也留得住回头路。', departure: '林成了桥，明成了路标。', rows: ['#######', '#BP.L.#', '#.....#', '###?###', '###~###', '###~###', '###G###', '#######'] },
  { id: 'woven-2', title: '门后的光', subtitle: '拿走不，开门；放下它，再带灯。', arrival: '一个不和一盏明，都要用同一只手安排。门打开后，也会让光通过。', departure: '打开的门，把光送到了另一边。', rows: ['#...###', '#P.B..#', '###D###', '###?###', '###?###', '###G###', '#######'], sentences: [{ at: [1,0], subject: '门', negated: true }] },
  { id: 'woven-3', title: '风口借灯', subtitle: '可以停风走直路，也可以用木绕水路。', arrival: '先让明照着路。一个不可以停风，木也可以绕过风口。你来选择。', departure: '风路与水路，都留下了你的办法。', rows: ['#.n.###', '#P.Bw.#', '#.....#', '##???##', '##~#^##', '##...G#', '#######'], sentences: [{ at: [1,2], subject: '风' }] },
  { id: 'woven-4', title: '先送谁过岸', subtitle: '灯与林分两趟走，风口要先安静。', arrival: '不放到风句，才可以来回搬灯和林。每一趟都只带一件。', departure: '停风让来回成为可能，林和明各走了一趟。', rows: ['#n#...#', '#P.#.##', '#BL#..#', '##.>.##', '####.##', '####?##', '####~##', '####~##', '####G##', '#######'], sentences: [{ at: [3,0], subject: '风' }] },
  { id: 'woven-5', title: '带光回家', subtitle: '开门、调光、借桥；两条路都可以通向家。', arrival: '最后一间没有固定顺序。门后的风路与水路，都需要安排明和木。', departure: '人带着自己的办法，走回了有光的家。', rows: ['#...###', '#PBL..#', '###D###', '#.....#', '##~#^##', '##~#.##', '#...??G', '#######'], sentences: [{ at: [1,0], subject: '门', negated: true }, { at: [0,2], subject: '风' }] },
];
export const ROOMS: Room[] = [...PLANS, ...LIGHT_PLANS, ...WOVEN_PLANS].map(room);
export const chapterRooms = (chapterId: string) => ROOMS.filter(r => r.chapterId === chapterId);
export const roomIndexById = (roomId: string) => ROOMS.findIndex(r => r.id === roomId);
export const chapterForRoom = (index: number) => CHAPTERS.find(c => c.id === ROOMS[index]?.chapterId)!;
export const lastInChapter = (index: number) => !ROOMS[index + 1] || ROOMS[index + 1].chapterId !== ROOMS[index].chapterId;
