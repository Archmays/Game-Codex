import type { EnglishSentenceRecord, SupportWordRecord } from "./types";

type SentenceSeed = Omit<EnglishSentenceRecord, "sourceNote" | "reviewStatus" | "revisionHash">;

function sentence(seed: SentenceSeed): EnglishSentenceRecord {
  return { ...seed, sourceNote: "project-authored", reviewStatus: "accepted", revisionHash: `sentence-v2-${seed.id.replace("sentence-", "")}` };
}

export const ENGLISH_V2_SENTENCES: readonly EnglishSentenceRecord[] = [
  sentence({ id: "sentence-cat-home", text: "The cat is home.", targetWordId: "word-cat", targetSlotIndex: 1, supportWordIds: ["support-the", "support-is", "support-home"], worldActionId: "cat-comes-home", scaffoldZh: "猫回家了。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-dog-dig", text: "The dog can dig.", targetWordId: "word-dog", targetSlotIndex: 1, supportWordIds: ["support-the", "support-can", "support-dig"], worldActionId: "dog-digs-garden", scaffoldZh: "狗会挖土。", decodabilityStatus: "mostly-core-patterns" }),
  sentence({ id: "sentence-fish-swim", text: "The fish can swim.", targetWordId: "word-fish", targetSlotIndex: 1, supportWordIds: ["support-the", "support-can", "support-swim"], worldActionId: "fish-swims", scaffoldZh: "鱼会游泳。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-duck-splash", text: "The duck can splash.", targetWordId: "word-duck", targetSlotIndex: 1, supportWordIds: ["support-the", "support-can", "support-splash"], worldActionId: "duck-splashes", scaffoldZh: "鸭子会溅起水花。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-frog-hop", text: "The frog can hop.", targetWordId: "word-frog", targetSlotIndex: 1, supportWordIds: ["support-the", "support-can", "support-hop"], worldActionId: "frog-hops", scaffoldZh: "青蛙会跳。", decodabilityStatus: "mostly-core-patterns" }),
  sentence({ id: "sentence-bee-flower", text: "The bee finds a flower.", targetWordId: "word-bee", targetSlotIndex: 1, supportWordIds: ["support-the", "support-finds", "support-a", "support-flower"], worldActionId: "bee-finds-flower", scaffoldZh: "蜜蜂找到了一朵花。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-dad-door", text: "Dad opens the door.", targetWordId: "word-dad", targetSlotIndex: 0, supportWordIds: ["support-opens", "support-the", "support-door"], worldActionId: "dad-opens-door", scaffoldZh: "爸爸打开门。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-mom-hello", text: "Mom waves hello.", targetWordId: "word-mom", targetSlotIndex: 0, supportWordIds: ["support-waves", "support-hello"], worldActionId: "mom-waves", scaffoldZh: "妈妈挥手问好。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-baby-cozy", text: "The baby is cozy.", targetWordId: "word-baby", targetSlotIndex: 1, supportWordIds: ["support-the", "support-is", "support-cozy"], worldActionId: "baby-rests", scaffoldZh: "宝宝很舒服。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-boy-waves", text: "The boy waves.", targetWordId: "word-boy", targetSlotIndex: 1, supportWordIds: ["support-the", "support-waves"], worldActionId: "boy-waves", scaffoldZh: "男孩挥挥手。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-girl-kite", text: "The girl has a kite.", targetWordId: "word-girl", targetSlotIndex: 1, supportWordIds: ["support-the", "support-has", "support-a", "support-kite"], worldActionId: "girl-finds-kite", scaffoldZh: "女孩有一只风筝。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-friend-here", text: "My friend is here.", targetWordId: "word-friend", targetSlotIndex: 1, supportWordIds: ["support-my", "support-is", "support-here"], worldActionId: "friend-arrives", scaffoldZh: "我的朋友来了。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-apple-rolls", text: "The apple rolls.", targetWordId: "word-apple", targetSlotIndex: 1, supportWordIds: ["support-the", "support-rolls"], worldActionId: "apple-rolls", scaffoldZh: "苹果滚动起来。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-egg-warm", text: "The egg is warm.", targetWordId: "word-egg", targetSlotIndex: 1, supportWordIds: ["support-the", "support-is", "support-warm"], worldActionId: "egg-warms", scaffoldZh: "鸡蛋是温热的。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-milk-cup", text: "Milk fills the cup.", targetWordId: "word-milk", targetSlotIndex: 0, supportWordIds: ["support-fills", "support-the", "support-cup"], worldActionId: "milk-fills-cup", scaffoldZh: "牛奶装满杯子。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-cake-ready", text: "The cake is ready.", targetWordId: "word-cake", targetSlotIndex: 1, supportWordIds: ["support-the", "support-is", "support-ready"], worldActionId: "cake-table-lights", scaffoldZh: "蛋糕准备好了。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-water-pond", text: "Water fills the pond.", targetWordId: "word-water", targetSlotIndex: 0, supportWordIds: ["support-fills", "support-the", "support-pond"], worldActionId: "water-fills-pond", scaffoldZh: "水注满池塘。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-bread-good", text: "The bread smells good.", targetWordId: "word-bread", targetSlotIndex: 1, supportWordIds: ["support-the", "support-smells", "support-good"], worldActionId: "bread-sends-aroma", scaffoldZh: "面包闻起来很香。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-run-can", text: "I can run.", targetWordId: "word-run", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-runs-path", scaffoldZh: "我会跑。", decodabilityStatus: "mostly-core-patterns" }),
  sentence({ id: "sentence-jump-can", text: "I can jump.", targetWordId: "word-jump", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-jumps", scaffoldZh: "我会跳。", decodabilityStatus: "mostly-core-patterns" }),
  sentence({ id: "sentence-sit-can", text: "I can sit.", targetWordId: "word-sit", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-sits", scaffoldZh: "我会坐。", decodabilityStatus: "mostly-core-patterns" }),
  sentence({ id: "sentence-sleep-can", text: "I can sleep.", targetWordId: "word-sleep", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-sleeps", scaffoldZh: "我会睡觉。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-eat-can", text: "I can eat.", targetWordId: "word-eat", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-eats", scaffoldZh: "我会吃。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-sing-can", text: "I can sing.", targetWordId: "word-sing", targetSlotIndex: 2, supportWordIds: ["support-i", "support-can"], worldActionId: "child-sings", scaffoldZh: "我会唱歌。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-red-shell", text: "The shell is red.", targetWordId: "word-red", targetSlotIndex: 3, supportWordIds: ["support-the", "support-shell", "support-is"], worldActionId: "shell-turns-red", scaffoldZh: "贝壳是红色的。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-blue-boat", text: "The boat is blue.", targetWordId: "word-blue", targetSlotIndex: 3, supportWordIds: ["support-the", "support-boat", "support-is"], worldActionId: "boat-turns-blue", scaffoldZh: "小船是蓝色的。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-green-leaf", text: "The leaf is green.", targetWordId: "word-green", targetSlotIndex: 3, supportWordIds: ["support-the", "support-leaf", "support-is"], worldActionId: "leaf-turns-green", scaffoldZh: "叶子是绿色的。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-yellow-sun", text: "The sun is yellow.", targetWordId: "word-yellow", targetSlotIndex: 3, supportWordIds: ["support-the", "support-sun", "support-is"], worldActionId: "sun-turns-yellow", scaffoldZh: "太阳是黄色的。", decodabilityStatus: "meaning-first" }),
  sentence({ id: "sentence-one-shell", text: "One shell shines.", targetWordId: "word-one", targetSlotIndex: 0, supportWordIds: ["support-shell", "support-shines"], worldActionId: "one-shell-shines", scaffoldZh: "一个贝壳在发光。", decodabilityStatus: "mixed-with-supported-words" }),
  sentence({ id: "sentence-two-boats", text: "Two boats sail.", targetWordId: "word-two", targetSlotIndex: 0, supportWordIds: ["support-boats", "support-sail"], worldActionId: "two-boats-sail", scaffoldZh: "两艘小船启航。", decodabilityStatus: "mixed-with-supported-words" }),
] as const;

const SUPPORT_WORDS = {
  the: "supported", is: "supported", home: "not-assessed", can: "regular", dig: "regular", swim: "regular", splash: "supported", hop: "regular", finds: "not-assessed", a: "supported", flower: "not-assessed",
  opens: "not-assessed", door: "not-assessed", waves: "not-assessed", hello: "not-assessed", cozy: "not-assessed", has: "supported", kite: "supported", my: "supported", here: "not-assessed",
  rolls: "not-assessed", warm: "not-assessed", fills: "not-assessed", cup: "regular", ready: "not-assessed", pond: "regular", smells: "not-assessed", good: "supported", i: "supported",
  shell: "supported", boat: "supported", leaf: "not-assessed", sun: "regular", shines: "not-assessed", boats: "not-assessed", sail: "supported",
} as const;

export const ENGLISH_V2_SUPPORT_WORDS: readonly SupportWordRecord[] = Object.entries(SUPPORT_WORDS).map(([display, decodingNote]) => ({
  id: `support-${display}`,
  display: display === "i" ? "I" : display,
  decodingNote,
}));
