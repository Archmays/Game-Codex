import type { ActorId } from './model';
export type Pick = {
    kind: 'ring-target' | 'ring-place' | 'lamp-wall' | 'release' | 'capture' | 'npc-move' | 'npc-hold';
    who: ActorId;
    target?: string;
    tool?: 'ring' | 'lamp';
};
