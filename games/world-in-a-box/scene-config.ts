export const BOX_SCENES={
 'window-breeze':{title:'窗边有风',load:()=>import('./runtime').then(m=>m.mountWorldBox)},
 'dresden-river-campus':{title:'德累斯顿',load:()=>import('./dresden-runtime').then(m=>m.mountDresden)},
 'frozen-elsa-playground':{title:'艾莎的冰雪游乐日',load:()=>import('./frozen-runtime').then(m=>m.mountFrozen)}
} as const;
export type BoxScene=keyof typeof BOX_SCENES;
export const AUDIO_SCENES={
 'window-breeze':{environment:'room',extra:['wind','boat','tram']},
 'river-campus':{environment:'river',extra:['wind','boat','tram']},
 'frozen-elsa-playground':{environment:'frozen-air',extra:['frozen-gather','frozen-crystal','frozen-slide','frozen-hooves','frozen-skate','frozen-snow','frozen-frost','frozen-start','frozen-stop','frozen-reform','frozen-door','frozen-chandelier']}
} as const;
export type AudioScene=keyof typeof AUDIO_SCENES;
