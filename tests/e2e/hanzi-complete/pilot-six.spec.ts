import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { expect, test, type Page, type Locator } from "@playwright/test";
import { COMPLETE_CORE_CHARACTER_NODES } from "../../../games/hanzi-radical-battle/complete/content-graph/core-characters";
import { PILOT_SIX_DEFINITIONS } from "../../../games/hanzi-radical-battle/complete/chapters/chapter-two/pilot-six";
import { createFreshCompleteSave, updateCompleteSave, HANZI_MAGIC_COMPLETE_SAVE_KEY } from "../../../games/hanzi-radical-battle/complete/save/complete-save";
import { pilotRun } from "../../hanzi-complete/pilot-six-fixture";
const output = resolve("tmp/tasks/GAME-CODEX-STEP3-GAMEPLAY-VISUAL-PILOT/pilot-browser");
mkdirSync(output, { recursive: true });
const route = "/?play=hanzi-magic-complete&from=hub&chapter=two";
const shell = (page:Page) => page.getByTestId("hanzi-complete-chapter-two");
test.beforeEach(async ({ context }) => {
 if (process.env.PILOT_PREVIEW_URL) {
  await context.route("http://127.0.0.1:5175/**", async request => {
   const response = await request.fetch({ url: request.request().url().replace("http://127.0.0.1:5175", process.env.PILOT_PREVIEW_URL!) });
   await request.fulfill({ response });
  });
 }
});
async function seed(page:Page, replay?:ReturnType<typeof pilotRun>) {
 const save = updateCompleteSave(createFreshCompleteSave(), {
  unlockedChapterIds:["chapter-one","chapter-two"], settings:{muted:true,reducedMotion:true,inputMode:"auto"},
  // This published-r1 regression stays on its original interpreter after new-run promotion.
  chapterTwoReplay:replay?{seed:replay.seed,initialHeroId:replay.initialHeroId,ruleset:replay.ruleset,actions:replay.actions}:{seed:"pilot-six-browser",initialHeroId:"light-speaker",ruleset:"pilot-six-r1",actions:[]},
 });
 await page.addInitScript(({key,value})=>{if(!localStorage.getItem(key))localStorage.setItem(key,value);},{key:HANZI_MAGIC_COMPLETE_SAVE_KEY,value:JSON.stringify(save)});
}
async function activate(page:Page, target:Locator, touch:boolean, keyboard=false) {
 if(keyboard){await target.focus();await page.keyboard.press("Enter");}
 else if(touch)await target.tap();else await target.click();
}
async function build(page:Page,touch:boolean,keyboard=false) {
 const id=await shell(page).getAttribute("data-current-character-id");
 const target=COMPLETE_CORE_CHARACTER_NODES.find(n=>n.id===id)!;
 for(const component of target.components){
  await activate(page,page.locator('[data-card-id="'+id+'-target-'+component.order+'"]'),touch,keyboard);
  const slot = page.locator('[data-slot-id="'+component.slotId+'"]');
  if (component.slotId === "outer" && target.structure === "semi-enclosure" && !keyboard) {
   // The L-shaped slot's centre is a real hole; use its visible 56+ px left arm.
   if (touch) await slot.tap({position:{x:100,y:(await slot.boundingBox())!.height-24}}); else await slot.click({position:{x:24,y:40}});
  } else await activate(page,slot,touch,keyboard);
 }
}
async function geometry(page:Page) {
 const result=await page.evaluate(()=>{
  const stage=document.querySelector<HTMLElement>(".pilot-stage")!;
  const r=stage.getBoundingClientRect();
  const controls=[...document.querySelectorAll<HTMLElement>(".pilot-adventure button:not(:disabled),.hmc2-header button,.hmc2-header a")].filter(e=>e.getBoundingClientRect().width>0);
  return {width:innerWidth,scrollWidth:document.documentElement.scrollWidth,undersized:controls.filter(e=>{const r=e.getBoundingClientRect();return r.width<47.5||r.height<47.5;}).map(e=>e.innerText),
   missed:[...stage.querySelectorAll<HTMLElement>("button")].filter(e=>{const b=e.getBoundingClientRect();if(b.top<r.top||b.bottom>r.bottom||b.left<r.left||b.right>r.right)return true;const x=b.x+b.width/2,y=b.y+b.height/2;return y>=0&&y<innerHeight&&!e.contains(document.elementFromPoint(x,y));}).map(e=>e.innerText)};
 });expect(result.scrollWidth).toBeLessThanOrEqual(result.width+1);expect(result.undersized).toEqual([]);expect(result.missed).toEqual([]);return result;
}
async function capture(page:Page,id:string,rows:any[]) {
 await page.evaluate(()=>document.fonts.ready);
 await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
 const path=resolve(output,id+".png");await page.screenshot({path,fullPage:true});
 rows.push({id,route:page.url(),viewport:page.viewportSize(),sha256:createHash("sha256").update(readFileSync(path)).digest("hex"),geometry:await geometry(page)});
 writeFileSync(resolve(output,id.split("-")[0]+"-checks.json"),JSON.stringify(rows,null,2));
}
test("six pilot encounters with actual input, meaningful branches, restore and full chapter linkage",async({page},info)=>{
 test.setTimeout(180_000);const touch=info.project.name==="mobile-touch";const width=touch?390:1440;
 await page.setViewportSize({width,height:touch?844:900});await seed(page);
 const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));page.on("console",e=>{if(e.type()==="error")errors.push(e.text());});
 const requests:string[]=[];page.on("request",r=>{if(/^https?:/.test(r.url())&&new URL(r.url()).hostname!=="127.0.0.1")requests.push(r.url());});
 await page.goto(route);await activate(page,page.getByRole("button",{name:"走上木语树冠"}),touch);
 const rows:any[]=[];
 for(let i=0;i<6;i++){
  const d=PILOT_SIX_DEFINITIONS[i];await expect(shell(page)).toHaveAttribute("data-current-character-id",d.characterId);
  await capture(page,width+"-"+(i+1)+"-build",rows);
  if(i===5){
   await activate(page,page.locator('[data-card-id="'+d.characterId+'-target-1"]'),touch);
   const outer=page.locator('[data-slot-id="outer"]');
   if(touch)await outer.tap({position:{x:24,y:40}});else await outer.click({position:{x:24,y:40}});
   await capture(page,width+"-6-outer-placed",rows);
   await activate(page,page.getByRole("button",{name:"收回一步"}),touch);
  }
  if(i===0){
   await activate(page,page.locator('[data-card-id="'+d.characterId+'-target-1"]'),touch);
   await activate(page,page.locator('[data-slot-id="right"]'),touch);
   await expect(page.getByRole("status")).toContainText("不住在这里");
  }
  await build(page,touch);await expect(shell(page)).toHaveAttribute("data-phase","pilot-meaning");
  await capture(page,width+"-"+(i+1)+"-before",rows);
  if(i===2)await activate(page,page.getByRole("button",{name:touch?"想聊聊":"想静静"}),touch);
  else if(i===5){
   await activate(page,page.locator('[data-pilot-move="'+(touch?"char-u8ff7":"char-u9053")+'"]'),touch);
   if(touch){await capture(page,width+"-6-moving-middle",rows);await page.reload();await expect(shell(page)).toHaveAttribute("data-phase","pilot-meaning");await activate(page,page.locator('[data-pilot-move="char-u9053"]'),touch);}
  }else await activate(page,page.locator('[data-action="pilot-magic"]'),touch);
  await expect(shell(page)).toHaveAttribute("data-phase","family-connect");
  if(i===3)await activate(page,page.getByRole("button",{name:"用已学的指光看清根线"}),touch);
  if(i===0){
   for(const id of [d.startId,d.decoyId])await activate(page,page.locator('[data-family-character-id="'+id+'"]'),touch);
   await activate(page,page.getByRole("button",{name:"接好这两个字碑"}),touch);
   await expect(page.getByRole("status")).toContainText("不同");await expect(page.locator(".pilot-bridge")).toHaveCount(0);
  }
  const pairs=touch&&d.nodeIds.length>2?[[d.startId,d.nodeIds[1]],[d.nodeIds[1],d.endId]]:[[d.startId,d.endId]];
  for(let p=0;p<pairs.length;p++){
   for(const id of pairs[p])await activate(page,page.locator('[data-family-character-id="'+id+'"]'),touch);
   await activate(page,page.getByRole("button",{name:"接好这两个字碑"}),touch);
   if(p===0&&pairs.length>1){await expect(shell(page)).toHaveAttribute("data-phase","family-connect");await capture(page,width+"-"+(i+1)+"-partial-path",rows);}
  }
  await expect(shell(page)).toHaveAttribute("data-phase","family-result");
  await capture(page,width+"-"+(i+1)+"-after",rows);
  if(i===1){
   const replay=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).chapterTwoReplay,HANZI_MAGIC_COMPLETE_SAVE_KEY);
   await page.goto("/?play=hanzi-magic-complete&view=spellbook");
   await page.goto(route);expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).chapterTwoReplay,HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(replay);
  }
  if(i===5){
   const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),HANZI_MAGIC_COMPLETE_SAVE_KEY);
   expect(saved.repairedObjectIds).not.toContain("spring-waterwheel");expect(saved.unlockedChapterIds).not.toContain("chapter-three");
  }
  await activate(page,page.getByRole("button",{name:"沿通路继续"}),touch);
  while(["episode-repair","episode-complete"].includes(await shell(page).getAttribute("data-phase")??""))await activate(page,page.locator('[data-action="continue"]'),touch);
 }
 await expect(shell(page)).toHaveAttribute("data-current-character-id","char-u8ff7");
 // Continue the unchanged 07+ route through the chapter and enter chapter three.
 for(let guard=0;guard<220;guard++){
  const phase=await shell(page).getAttribute("data-phase");if(phase==="chapter-summary")break;
  if(phase==="build")await build(page,touch);
  else if(phase==="family-connect"){await activate(page,page.locator("[data-family-character-id]").nth(0),touch);await activate(page,page.locator("[data-family-character-id]").nth(1),touch);await activate(page,page.locator('[data-action="connect-family"]'),touch);}
  else if(phase==="ability-choice")await activate(page,page.locator("[data-ability-id]").first(),touch);
  else await activate(page,page.locator('[data-action="'+({ "behavior-telegraph":"begin-behavior","behavior-effect":"recover-behavior","core-intro":"start-core",ending:"finish-ending"}[phase!]??"continue")+'"]'),touch);
 }
 await expect(shell(page)).toHaveAttribute("data-phase","chapter-summary");
 await expect(shell(page)).toHaveAttribute("data-triggered-ability-count","1");
 const saved=await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),HANZI_MAGIC_COMPLETE_SAVE_KEY);
 expect(saved.unlockedChapterIds).toContain("chapter-three");expect(saved.completedChapterIds).toContain("chapter-two");
 await page.goto("/?play=hanzi-magic-complete&chapter=three");await expect(page.getByTestId("hanzi-complete-chapter-three")).toBeVisible();
 expect(await page.evaluate(key=>JSON.parse(localStorage.getItem(key)!).chapterTwoReplay,HANZI_MAGIC_COMPLETE_SAVE_KEY)).toEqual(saved.chapterTwoReplay);
 expect(errors).toEqual([]);expect(requests).toEqual([]);
});
test("narrow and tablet controls, half enclosure, 200 percent layout and keyboard",async({page},info)=>{
 test.setTimeout(90_000);const touch=info.project.name==="mobile-touch";
 const replay=pilotRun({stop:s=>s.episodeIndex===1&&s.encounterIndex===1&&s.phase==="build"});
 await seed(page,replay);const rows:any[]=[];
 for(const width of [768,360]){
  await page.setViewportSize({width,height:width===768?1024:844});await page.goto(route);await capture(page,"supp-"+width+"-half-enclosure",rows);
 }
 await page.setViewportSize({width:720,height:450});await page.goto(route);
 // 720 CSS px is the layout viewport of a 1440 display at 200% browser zoom.
 await capture(page,"supp-200percent-layout",rows);
 await build(page,touch,!touch);await expect(shell(page)).toHaveAttribute("data-phase","pilot-meaning");
 await page.keyboard.press("Tab");await expect(page.locator(":focus")).toBeVisible();
});
