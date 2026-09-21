import type { GameDefinition, MountedGame } from '../../packages/game-core';
export const worldInABoxGame:GameDefinition={
  id:'world-in-a-box',title:'世界盒子',description:'拼装窗边有风与德累斯顿城市。',subject:'空间与观察',recommendedAge:'亲子共玩',learningGoal:'观察空间、因果与协作关系。',status:'两个可玩盒子',playLabel:'打开小世界',route:'?play=world-in-a-box&from=hub',
  mount(context){let mounted:MountedGame|undefined;let dead=false;context.container.textContent='正在打开小世界……';void import('./boxes').then(({mountBoxes})=>{if(!dead)mounted=mountBoxes(context);});return{destroy(){dead=true;mounted?.destroy();}};}
};
