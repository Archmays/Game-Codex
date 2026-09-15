import type {GameDefinition} from '../../packages/game-core';
export const hanziStrokeLab:GameDefinition={
  id:'hanzi-stroke-lab',title:'汉字书房',description:'查字、手写找字与逐笔看笔顺。',subject:'识字工具',recommendedAge:'儿童与成人',learningGoal:'查阅汉字读音和书写顺序',status:'可用',playLabel:'查字与笔顺',route:'?play=hanzi-stroke-lab',
  mount(context){let disposed=false;let clean:(()=>void)|undefined;context.container.textContent='正在打开汉字书房……';void import('./workbench').then(({mountHanziStrokeLab})=>{if(!disposed)clean=mountHanziStrokeLab(context.container,context.onExit).destroy;});return{destroy(){disposed=true;clean?.();}};}
};
