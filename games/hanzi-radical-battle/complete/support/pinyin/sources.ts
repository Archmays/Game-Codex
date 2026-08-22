import type { PinyinSourceRecord } from "./types";

export const PINYIN_SOURCE_RECORDS = [
  {
    id: "pinyin-scheme-1958", sourceKind: "language-standard", title: "汉语拼音方案", version: "1958 approved scheme", date: "1958-02-11",
    location: "https://www.moe.gov.cn/jyb_sjzl/ziliao/A19/195802/t19580201_186000.html",
    supports: ["initial/final inventory", "tone marks", "y/w spelling", "ü spelling", "iou/uei/uen abbreviations"],
    limitation: "Defines standard spelling and annotation; it does not define this product's child-facing interaction or fixed word choices.", access: "Official Ministry of Education page; public online access.",
  },
  {
    id: "gbt-16159-2012", sourceKind: "language-standard", title: "汉语拼音正词法基本规则", version: "GB/T 16159-2012", date: "2012-06-29",
    location: "https://www.moe.gov.cn/ewebeditor/uploadfile/2015/01/13/20150113091717604.pdf",
    supports: ["orthographic hierarchy", "tone placement", "modern Chinese Pinyin spelling rules"],
    limitation: "Primarily governs word orthography; per-character readings still require a fixed lexical context and dictionary/content source.", access: "Official Ministry of Education PDF; public online access.",
  },
  {
    id: "moe-curriculum-2022", sourceKind: "curriculum", title: "义务教育课程方案和课程标准（2022年版）", version: "2022", date: "2022-03-25",
    location: "https://www.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html",
    supports: ["activity-based and contextual primary literacy framing"],
    limitation: "Does not validate individual readings, decompositions, age labels, or learning-effect claims.", access: "Official Ministry of Education notice and attachments; public online access.",
  },
  {
    id: "repo-hanzi-v3-reading-senses", sourceKind: "repository", title: "Hanzi Magic Battle V3 CharacterNode and ReadingSense graph", version: "3.0.0-content-1", date: "2026-08-20",
    location: "games/hanzi-radical-battle/complete/content-graph",
    supports: ["72 stable character identities", "fixed phrases", "citation Pinyin", "risk and provenance links"],
    limitation: "Repository records are a reviewed product layer; they retain and cite their external cross-check sources.", access: "Local canonical repository source.",
  },
  {
    id: "research-pinyin-intervention-2020", sourceKind: "research", title: "A computer-based Pinyin intervention for disadvantaged children in China", version: "Dyslexia 26(4), DOI 10.1002/dys.1654", date: "2020-03-08",
    location: "https://pubmed.ncbi.nlm.nih.gov/32147894/",
    supports: ["Pinyin practice can train Pinyin accuracy/fluency and onset-rime/phonemic awareness in the studied population"],
    limitation: "A bounded intervention study does not prove this game's effectiveness or generalize to every child.", access: "PubMed bibliographic record and abstract; publisher rights apply to the article.",
  },
  {
    id: "research-analytic-pinyin-2010", sourceKind: "research", title: "Small wins big: analytic pinyin skills promote Chinese word reading", version: "Psychological Science 21(8), DOI 10.1177/0956797610375447", date: "2010-06-25",
    location: "https://pubmed.ncbi.nlm.nih.gov/20581343/",
    supports: ["analytic Pinyin representations and invented spelling were predictive of later word reading in the study"],
    limitation: "Predictive evidence does not establish a causal learning effect for this activity.", access: "PubMed bibliographic record and abstract; publisher rights apply to the article.",
  },
  {
    id: "research-tone-awareness-2011", sourceKind: "research", title: "The role of tone awareness and pinyin knowledge in Chinese reading", version: "Writing Systems Research 3(1), DOI 10.1093/wsr/wsr010", date: "2011-12-20",
    location: "https://doi.org/10.1093/wsr/wsr010",
    supports: ["tone awareness can contribute independently to Chinese reading measures in the studied primary-school sample"],
    limitation: "Association in one sample does not validate TTS quality or this product's learning outcome.", access: "Publisher abstract/metadata; article access may be limited.",
  },
  {
    id: "research-guided-retrieval-2014", sourceKind: "research", title: "Retrieval-based learning: The need for guided retrieval in elementary school children", version: "JARMAC 3(3), DOI 10.1016/j.jarmac.2014.07.008", date: "2014-09-01",
    location: "https://doi.org/10.1016/j.jarmac.2014.07.008",
    supports: ["young learners benefit from guided, supported retrieval rather than unsupported free recall"],
    limitation: "The study does not prescribe this game's content, difficulty, or interface.", access: "Publisher abstract/metadata; article access may be limited.",
  },
  {
    id: "research-chinese-paired-associate-2021", sourceKind: "research", title: "The relationship between paired associate learning and Chinese word reading in kindergarten children", version: "Journal of Research in Reading 44, DOI 10.1111/1467-9817.12333", date: "2021-01-01",
    location: "https://doi.org/10.1111/1467-9817.12333",
    supports: ["paired-associate learning is a relevant construct in early Chinese word-reading research"],
    limitation: "Relational evidence does not prove this matching activity improves reading or retention.", access: "Publisher metadata/abstract; article access may be limited.",
  },
] as const satisfies readonly PinyinSourceRecord[];

export const PINYIN_RUNTIME_SOURCE_IDS = ["pinyin-scheme-1958", "gbt-16159-2012", "repo-hanzi-v3-reading-senses"] as const;
