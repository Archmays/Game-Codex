import type { GameDefinition, MountedGame } from '../../packages/game-core';
export const worldInABoxGame:GameDefinition={
  id:'world-in-a-box',title:'世界盒子',description:'把八件小物放回窗边，开窗，让风轻轻吹进来。',subject:'空间与观察',recommendedAge:'亲子共玩',learningGoal:'观察形状、空间关系与机关因果。',status:'可玩样板',playLabel:'打开小世界',route:'?play=world-in-a-box',
  mount(context){let mounted:MountedGame|undefined;let dead=false;context.container.textContent='正在打开小世界……';void import('./runtime').then(({mountWorldBox})=>{if(!dead)mounted=mountWorldBox(context);});return{destroy(){dead=true;mounted?.destroy();}};}
};
