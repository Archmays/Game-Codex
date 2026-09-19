import type { GameDefinition, MountedGame } from '../../packages/game-core';
export const worldInABoxGame:GameDefinition={
  id:'world-in-a-box',title:'世界盒子',description:'拼好窗边的小物，或打开德累斯顿，乘电车、坐船、看进图书馆。',subject:'空间与观察',recommendedAge:'亲子共玩',learningGoal:'观察形状、空间关系与机关因果。',status:'两个可玩盒子',playLabel:'打开小世界',route:'?play=world-in-a-box&from=hub',
  mount(context){let mounted:MountedGame|undefined;let dead=false;context.container.textContent='正在打开小世界……';void import('./boxes').then(({mountBoxes})=>{if(!dead)mounted=mountBoxes(context);});return{destroy(){dead=true;mounted?.destroy();}};}
};
