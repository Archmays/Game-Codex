import { planAction, planTogether, planReturnPhoto, actorName, type Plan } from './intent';
import { entityName, nodeNames } from './landmarks';
import { layout, position, apply, item, actor, type Action, type State } from './model';
import type { OddityScene } from './scene';
import type { Pick } from './selection';
interface PanelState {
    selected: string;
    picking: Pick | null;
    more: boolean;
    active: boolean;
    scene: OddityScene | undefined;
}
interface PanelActions {
    state: () => State;
    perform: (plan: Plan, label: string) => void;
    startPicking: (pick: Pick) => void;
    selectEntity: (id: string) => void;
    preserve: (html: string) => void;
    refresh: () => void;
    preview: HTMLElement;
}
/** Builds only the selected object's explicit actions; rules remain in model/intent. */
export function createActionPanel({ state, perform, startPicking, selectEntity, preserve, refresh, preview }: PanelActions) {
    const callbacks = new Map<string, () => void>(), previews = new Map<string, () => void>();
    const button = (id: string, label: string, extra = '') => `<button type="button" data-cmd="${id}" ${extra}>${label}</button>`;
    function addAction(list: string[], id: string, label: string, fn: () => void) { callbacks.set(id, fn); list.push(button(id, label, `data-action-id="${id}"`)); }
    const lNodes = (s: State) => layout(s).nodes;
    function render({ selected, picking, more, active, scene }: PanelState) {
        callbacks.clear();
        previews.clear();
        const s = state(), who = actorName(s), list: string[] = [];
        const add = (id: string, label: string, fn: () => void) => addAction(list, id, label, fn);
        const act = (label: string, a: Action, approach = false) => { const id = 'action:' + a.type + ':' + ('actor' in a ? a.actor ?? s.active : s.active) + ':' + ('item' in a ? a.item : 'target' in a ? a.target : 'switch' in a ? a.switch : 'node' in a ? a.node : 'direction' in a ? a.direction : ''); add(id, label, () => perform(planAction(state(), a, approach), label)); previews.set(id, () => { const plan = planAction(state(), a, approach); if (plan.error) {
            if (plan.obstacle)
                scene?.showObstacle(plan.obstacle.p);
            preview.textContent = plan.error;
            return;
        } if (a.type === 'lamp' || a.type === 'ring' && a.target === 'lamp') {
            scene?.showLamp(a.direction ?? 1);
            preview.textContent = label + ' · 选择才会转灯';
        }
        else {
            const kind = a.type === 'ring' ? 'carry' : a.type === 'release' ? 'release' : approach ? 'interaction' : 'walk';
            scene?.showRoute(approach ? plan.motions.filter(m => m.kind === 'walk') : plan.motions, kind);
            preview.textContent = (approach ? '□ 操作站位 · ' : '') + label;
        } }); };
        let title = selected ? entityName(s, selected) : '先看看房间', detail = '选择地标或物件。人物头像和脚下符号相同。';
        if (active) {
            preserve('<p>行动中，不会排队执行多次点击。</p>');
            return;
        }
        if (picking) {
            title = '在场景中选择';
            detail = '选定就执行；Esc 或取消返回。';
            if (picking.kind === 'ring-place')
                act(`${actorName(s, picking.who)}：用扳指送到自己手边`, { type: 'ring', target: picking.target!, node: 'hand' });
            if (picking.kind === 'lamp-wall')
                for (let i = 0; i < 3; i++)
                    act(`${who}：${picking.tool === 'ring' ? '用扳指' : '用手'}转灯 → ${['房间后墙', '通道墙', '左侧墙'][i]}`, picking.tool === 'ring' ? { type: 'ring', target: 'lamp', direction: i } : { type: 'lamp', direction: i });
        }
        else if (selected) {
            const o = s.items.find(o => o.id === selected), person = s.actors.find(a => a.id === selected);
            if (o) {
                const pos = position(s, o.id), nearest = [...lNodes(s)].sort((a, b) => Math.hypot(a.p[0] - pos[0], a.p[2] - pos[2]) - Math.hypot(b.p[0] - pos[0], b.p[2] - pos[2]))[0];
                detail = `${nodeNames[nearest.id] ?? nearest.label} · ${o.holder ? actorName(s, o.holder) + '持有' : o.fixed ? '固定在场景中' : '放在场景中'}${o.id === 'photo' ? ' · ' + (s.photo ? '内有' + actorName(s, s.photo) : '空照片，容量一人') : ''}`;
            }
            if (person)
                detail = `${person.inside ? '在照片中' : (nodeNames[person.node] ?? layout(s).nodes.find(n => n.id === person.node)?.label)}${person.holding ? ' · 正保持' + entityName(s, person.holding) + '，走开会松手' : ''}`;
            if (selected === 'lamp') {
                const canHand = !apply(s, { type: 'lamp', direction: (s.lamp + 1) % 3 }).error, hasRing = item(s, 'ring').holder === s.active;
                if (canHand && hasRing) {
                    add('tool:ring', `${who}：用扳指转灯`, () => startPicking({ kind: 'lamp-wall', who: s.active, target: 'lamp', tool: 'ring' }));
                    add('tool:lamp', `${who}：用手转灯`, () => startPicking({ kind: 'lamp-wall', who: s.active, target: 'lamp', tool: 'lamp' }));
                }
                else {
                    for (let i = 0; i < 3; i++)
                        act(`${who}：${hasRing ? '用扳指' : '用手'}转灯 → ${['房间后墙', '通道墙', '左侧墙'][i]}`, hasRing ? { type: 'ring', target: 'lamp', direction: i } : { type: 'lamp', direction: i });
                }
            }
            else if (selected === 'door' && s.level === 2 || selected === 'camera' || selected === 'key') {
                detail = '相机只恢复原门板、铰链和锁孔；断路不恢复。连接和穿门由你分别决定。';
                if (!s.doorRestored)
                    act(`${who}：用相机恢复原门`, { type: 'restore' });
                if (!s.portal)
                    act(`${who}：走近锁孔，用钥匙连接小院`, { type: 'portal' }, true);
                if (s.portal)
                    act(`${who}：走过门`, { type: 'cross' }, true);
            }
            else if (selected === 'left' || selected === 'right') {
                detail = (s.actors.filter(a => a.holding === selected).map(a => actorName(s, a.id)).join('、') || '还没有人') + '正在保持；走开会松手。';
                for (const a of s.actors.filter(a => !a.inside))
                    act(`${a.id === 'npc' ? '请求' : ''}${actorName(s, a.id)}：${a.holding === selected ? '松开' + entityName(s, selected) : '走到' + entityName(s, selected) + '并按住'}`, { type: 'hold', switch: selected, actor: a.id }, true);
            }
            else if (selected === 'npc') {
                const photo = item(s, 'photo');
                if (photo.holder === 'npc') {
                    if (s.photo)
                        add('npc:release', '请求接应员：用照片释放同伴', () => startPicking({ kind: 'release', who: 'npc', target: s.photo! }));
                    add('npc:return-photo', '请求接应员：把照片放回托盘', () => perform(planReturnPhoto(state()), '把照片放回托盘'));
                }
                else if (!photo.holder)
                    act('请求接应员：走近并拿起照片', { type: 'take', item: 'photo', actor: 'npc' }, true);
                if (actor(s, 'npc').holding)
                    act('请求接应员：松开' + entityName(s, actor(s, 'npc').holding!), { type: 'hold', switch: actor(s, 'npc').holding!, actor: 'npc' });
                else
                    add('npc:hold', '请求接应员：选一个开关并按住', () => startPicking({ kind: 'npc-hold', who: 'npc' }));
                add('npc:move', '请求接应员：走到选定地点', () => startPicking({ kind: 'npc-move', who: 'npc' }));
            }
            else if (o?.id === 'photo') {
                if (o.holder === s.active) {
                    if (s.photo)
                        add('photo:release', `${who}：用照片释放${actorName(s, s.photo)}`, () => startPicking({ kind: 'release', who: s.active, target: s.photo! }));
                    else
                        for (const a of s.actors.filter(a => a.id !== s.active && !a.inside))
                            act(`${who}：走近并用照片收纳${actorName(s, a.id)}`, { type: 'capture', target: a.id }, true);
                }
                if (item(s, 'ring').holder === s.active)
                    add('photo:carry', `${who}：用扳指搬照片`, () => startPicking({ kind: 'ring-place', who: s.active, target: 'photo', tool: 'ring' }));
                if (!o.holder)
                    act(`${who}：走近并拿起照片`, { type: 'take', item: 'photo' }, true);
                if (o.holder === s.active)
                    act(`${who}：放下照片`, { type: 'drop', item: 'photo' });
                if (o.holder === 'npc')
                    add('photo:npc', '查看接应员的拿放与释放请求', () => selectEntity('npc'));
                if (!o.holder)
                    act('请求接应员：走近并拿起照片', { type: 'take', item: 'photo', actor: 'npc' }, true);
                if (o.holder === s.active)
                    for (const a of s.actors.filter(a => a.id !== s.active && !a.inside))
                        act(`${who}：走近并把照片交给${actorName(s, a.id)}`, { type: 'give', item: 'photo', to: a.id }, true);
            }
            else if (o && !o.fixed) {
                if (o.holder === s.active)
                    act(`${who}：放下${o.label}`, { type: 'drop', item: o.id });
                else if (!o.holder)
                    act(`${who}：走近并拿起${o.label}`, { type: 'take', item: o.id }, true);
                if (s.items.some(i => i.id === 'ring' && i.holder === s.active) && o.id !== 'ring')
                    add('carry:' + o.id, `${who}：用扳指搬${o.label}`, () => startPicking({ kind: 'ring-place', who: s.active, target: o.id, tool: 'ring' }));
            }
            else if (person && person.id !== s.active && !person.inside) {
                for (const o of s.items.filter(o => o.holder === s.active))
                    act(`${who}：走近并把${o.label}交给${actorName(s, person.id)}`, { type: 'give', item: o.id, to: person.id }, true);
            }
            if (selected === 'tray')
                detail = '这是接应托盘。搬照片时选这里作落点；拿片、放回和释放都需要明确请求。';
            if (selected === 'info:gap')
                detail = '门外走廊已经断开，普通步行无法通过。';
            if (selected === 'info:slot')
                detail = '高处的狭窄投递口只够扁平照片通过，人物身体过不去。';
        }
        if (s.level === 3 && s.latched && !s.won && !picking) {
            add('together', '一起出去：每个人沿道路走到出口', () => perform(planTogether(state()), '一起走到出口'));
            list.unshift(list.pop()!);
        }
        if (selected === 'camera' || selected === 'door' && s.level === 2)
            scene?.showPreview(!s.doorRestored);
        else
            scene?.showPreview(false);
        const shown = more ? list : list.slice(0, 3);
        if (list.length > 3)
            shown.push(button('more', more ? '收起' : '更多动作'));
        preserve(`<h3>${title}</h3><p>${detail}</p><div class="odd-options">${shown.join('')}</div>`);
        refresh();
    }
    return { render, callbacks, previews };
}
