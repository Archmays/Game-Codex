import type {Handwriting} from './handwriting';
import { Shelf, type CharacterIndex, type StrokeData } from './model';
import { StrokeView } from './stroke-view';
import { type Match } from './handwriting';

export interface Card {
  id:string; char:string; position:number; alive:boolean; node:HTMLElement; glyph:HTMLElement;
  data:StrokeData|null; loading:Promise<void>; renderer:StrokeView|null;
}
export function createStudyContext(root:HTMLElement,onExit?:()=>void) {
  const abort=new AbortController(),opts={signal:abort.signal};
  const shelf=new Shelf({getItem:k=>window.localStorage.getItem(k),setItem:(k,v)=>window.localStorage.setItem(k,v)});
  // Data/request identity is by character; all mutable state is by occurrence.
  const cache=new Map<string,Promise<StrokeData>>();
  let index:CharacterIndex={},destroyed=false,revision=0,cards:Card[]=[],query='',selected=0;
  let composing=false,compositionUntil=0,detail:Card|null=null,preview:Card|null=null,detailScroll=0,handChoice='';
  let queue:'idle'|'running'|'paused'='idle',cursor=0,queueRevision=0,skipped:string[]=[];
  const el=<T extends HTMLElement=HTMLElement>(s:string)=>root.querySelector<T>(s)!;
  const text=(s:string,value:string)=>{el(s).textContent=value;};
  const button=(s:string,fn:()=>void)=>el(s).addEventListener('click',fn,opts);
const ctx={
hand: null as unknown as Handwriting,
root,
onExit,
abort,
opts,
shelf,
cache,
index: index as CharacterIndex,
destroyed,
revision,
cards: cards as Card[],
query,
selected,
composing,
compositionUntil,
detail: detail as Card|null,
preview: preview as Card|null,
detailScroll,
handChoice,
queue: queue as 'idle'|'running'|'paused',
cursor,
queueRevision,
skipped: skipped as string[],el,text,button,
get input(){return el<HTMLInputElement>('#hsl-input');},
get grid(){return el<HTMLInputElement>('[data-grid]');},
get dialog(){return el<HTMLDialogElement>('[data-detail]');},
group(selector:string,values:string[],choose:(char:string,i:number)=>void,labels?:(char:string,i:number)=>string):void  { throw Error('Unbound study action: group'); },
renderCandidates(matches:Match[]):void  { throw Error('Unbound study action: renderCandidates'); },
setHand(open:boolean,focus=false):void  { throw Error('Unbound study action: setHand'); },
updateShelf():void  { throw Error('Unbound study action: updateShelf'); },
loadData(char:string):Promise<StrokeData>  { throw Error('Unbound study action: loadData'); },
makeCard(char:string,position:number):Card  { throw Error('Unbound study action: makeCard'); },
renderer(card:Card):StrokeView|null  { throw Error('Unbound study action: renderer'); },
updateCard(card:Card):void  { throw Error('Unbound study action: updateCard'); },
stopCards(except?:Card):void  { throw Error('Unbound study action: stopCards'); },
exitQueue():void  { throw Error('Unbound study action: exitQueue'); },
pauseAll():void  { throw Error('Unbound study action: pauseAll'); },
singlePlay(card:Card):void  { throw Error('Unbound study action: singlePlay'); },
updateQueue():void  { throw Error('Unbound study action: updateQueue'); },
async advance(token:number):Promise<void>  { throw Error('Unbound study action: advance'); },
playGroup(restart=false):void  { throw Error('Unbound study action: playGroup'); },
selectCard():void  { throw Error('Unbound study action: selectCard'); },
historyWrite(push:boolean):void  { throw Error('Unbound study action: historyWrite'); },
openDetail(card:Card,push=false):void  { throw Error('Unbound study action: openDetail'); },
populateDetail(card:Card):void  { throw Error('Unbound study action: populateDetail'); },
updateDetail():void  { throw Error('Unbound study action: updateDetail'); },
closeDetail(push=false,focus=true):void  { throw Error('Unbound study action: closeDetail'); },
buildQuery(value:string):void  { throw Error('Unbound study action: buildQuery'); },
search(value:string):void  { throw Error('Unbound study action: search'); },
restore():void  { throw Error('Unbound study action: restore'); }
};return ctx;
}
export type StudyContext=ReturnType<typeof createStudyContext>;
