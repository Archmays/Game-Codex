export interface EnglishWord {
  word: string;
  meaning: string;
  icon: string;
}

export interface EnglishWordCategory {
  title: string;
  words: EnglishWord[];
}

export interface PinyinCard {
  char: string;
  pinyin: string;
  meaningCn: string;
  meaningEn: string;
}

export const englishWordCategories: EnglishWordCategory[] = [
  {
    title: "动物",
    words: [
      { word: "cat", meaning: "猫", icon: "🐱" },
      { word: "dog", meaning: "狗", icon: "🐶" },
      { word: "pig", meaning: "猪", icon: "🐷" },
      { word: "cow", meaning: "奶牛", icon: "🐮" },
      { word: "duck", meaning: "鸭子", icon: "🦆" },
      { word: "fish", meaning: "鱼", icon: "🐟" },
      { word: "bear", meaning: "熊", icon: "🐻" },
      { word: "rabbit", meaning: "兔子", icon: "🐰" },
      { word: "frog", meaning: "青蛙", icon: "🐸" },
      { word: "tiger", meaning: "老虎", icon: "🐯" },
      { word: "horse", meaning: "马", icon: "🐴" },
      { word: "bee", meaning: "蜜蜂", icon: "🐝" }
    ]
  },
  {
    title: "家庭与人物",
    words: [
      { word: "dad", meaning: "爸爸", icon: "👨" },
      { word: "mom", meaning: "妈妈", icon: "👩" },
      { word: "baby", meaning: "宝宝", icon: "👶" },
      { word: "boy", meaning: "男孩", icon: "👦" },
      { word: "girl", meaning: "女孩", icon: "👧" },
      { word: "teacher", meaning: "老师", icon: "👩‍🏫" },
      { word: "friend", meaning: "朋友", icon: "👫" },
      { word: "family", meaning: "家庭", icon: "👨‍👩‍👧" }
    ]
  },
  {
    title: "颜色与数字",
    words: [
      { word: "red", meaning: "红色", icon: "🟥" },
      { word: "blue", meaning: "蓝色", icon: "🟦" },
      { word: "green", meaning: "绿色", icon: "🟩" },
      { word: "yellow", meaning: "黄色", icon: "🟨" },
      { word: "one", meaning: "一", icon: "1" },
      { word: "two", meaning: "二", icon: "2" },
      { word: "three", meaning: "三", icon: "3" },
      { word: "ten", meaning: "十", icon: "10" }
    ]
  },
  {
    title: "食物",
    words: [
      { word: "apple", meaning: "苹果", icon: "🍎" },
      { word: "banana", meaning: "香蕉", icon: "🍌" },
      { word: "egg", meaning: "鸡蛋", icon: "🥚" },
      { word: "milk", meaning: "牛奶", icon: "🥛" },
      { word: "cake", meaning: "蛋糕", icon: "🍰" },
      { word: "water", meaning: "水", icon: "💧" },
      { word: "bread", meaning: "面包", icon: "🍞" },
      { word: "rice", meaning: "米饭", icon: "🍚" }
    ]
  },
  {
    title: "动作",
    words: [
      { word: "run", meaning: "跑", icon: "🏃" },
      { word: "jump", meaning: "跳", icon: "↗" },
      { word: "walk", meaning: "走", icon: "🚶" },
      { word: "sit", meaning: "坐", icon: "🪑" },
      { word: "sleep", meaning: "睡觉", icon: "💤" },
      { word: "eat", meaning: "吃", icon: "🍽" },
      { word: "drink", meaning: "喝", icon: "🥤" },
      { word: "sing", meaning: "唱歌", icon: "🎤" }
    ]
  }
];

export const englishWords: EnglishWord[] = englishWordCategories.flatMap((category) => category.words);

export const pinyinCards: PinyinCard[] = [
  { char: "爱", pinyin: "ài", meaningCn: "喜爱", meaningEn: "love" },
  { char: "八", pinyin: "bā", meaningCn: "数字8", meaningEn: "eight" },
  { char: "爸", pinyin: "bà", meaningCn: "父亲", meaningEn: "dad" },
  { char: "杯", pinyin: "bēi", meaningCn: "杯子", meaningEn: "cup" },
  { char: "北", pinyin: "běi", meaningCn: "北方", meaningEn: "north" },
  { char: "本", pinyin: "běn", meaningCn: "书本", meaningEn: "book" },
  { char: "不", pinyin: "bù", meaningCn: "不/非", meaningEn: "no" },
  { char: "菜", pinyin: "cài", meaningCn: "菜肴", meaningEn: "dish" },
  { char: "茶", pinyin: "chá", meaningCn: "茶叶", meaningEn: "tea" },
  { char: "吃", pinyin: "chī", meaningCn: "吃饭", meaningEn: "eat" },
  { char: "大", pinyin: "dà", meaningCn: "巨大", meaningEn: "big" },
  { char: "的", pinyin: "de", meaningCn: "属于", meaningEn: "of" },
  { char: "点", pinyin: "diǎn", meaningCn: "时刻", meaningEn: "o'clock" },
  { char: "电", pinyin: "diàn", meaningCn: "电力", meaningEn: "electric" },
  { char: "读", pinyin: "dú", meaningCn: "读书", meaningEn: "read" },
  { char: "对", pinyin: "duì", meaningCn: "正确", meaningEn: "correct" },
  { char: "多", pinyin: "duō", meaningCn: "很多", meaningEn: "many" },
  { char: "儿", pinyin: "ér", meaningCn: "儿子", meaningEn: "son" },
  { char: "二", pinyin: "èr", meaningCn: "数字2", meaningEn: "two" },
  { char: "饭", pinyin: "fàn", meaningCn: "米饭", meaningEn: "rice" },
  { char: "飞", pinyin: "fēi", meaningCn: "飞行", meaningEn: "fly" },
  { char: "高", pinyin: "gāo", meaningCn: "高大", meaningEn: "high" },
  { char: "狗", pinyin: "gǒu", meaningCn: "小狗", meaningEn: "dog" },
  { char: "好", pinyin: "hǎo", meaningCn: "很好", meaningEn: "good" },
  { char: "喝", pinyin: "hē", meaningCn: "喝水", meaningEn: "drink" },
  { char: "家", pinyin: "jiā", meaningCn: "家庭", meaningEn: "home" },
  { char: "叫", pinyin: "jiào", meaningCn: "名字叫", meaningEn: "call" },
  { char: "九", pinyin: "jiǔ", meaningCn: "数字9", meaningEn: "nine" },
  { char: "开", pinyin: "kāi", meaningCn: "打开", meaningEn: "open" },
  { char: "看", pinyin: "kàn", meaningCn: "看见", meaningEn: "look" },
  { char: "来", pinyin: "lái", meaningCn: "来到", meaningEn: "come" },
  { char: "冷", pinyin: "lěng", meaningCn: "寒冷", meaningEn: "cold" },
  { char: "里", pinyin: "lǐ", meaningCn: "里面", meaningEn: "inside" },
  { char: "六", pinyin: "liù", meaningCn: "数字6", meaningEn: "six" },
  { char: "妈", pinyin: "mā", meaningCn: "母亲", meaningEn: "mom" },
  { char: "买", pinyin: "mǎi", meaningCn: "买东西", meaningEn: "buy" },
  { char: "猫", pinyin: "māo", meaningCn: "小猫", meaningEn: "cat" },
  { char: "门", pinyin: "mén", meaningCn: "大门", meaningEn: "door" },
  { char: "明", pinyin: "míng", meaningCn: "明天", meaningEn: "bright" },
  { char: "你", pinyin: "nǐ", meaningCn: "你们", meaningEn: "you" },
  { char: "七", pinyin: "qī", meaningCn: "数字7", meaningEn: "seven" },
  { char: "起", pinyin: "qǐ", meaningCn: "起床", meaningEn: "rise" },
  { char: "去", pinyin: "qù", meaningCn: "去哪", meaningEn: "go" },
  { char: "热", pinyin: "rè", meaningCn: "炎热", meaningEn: "hot" },
  { char: "人", pinyin: "rén", meaningCn: "人类", meaningEn: "person" },
  { char: "日", pinyin: "rì", meaningCn: "日子", meaningEn: "sun" },
  { char: "三", pinyin: "sān", meaningCn: "数字3", meaningEn: "three" },
  { char: "上", pinyin: "shàng", meaningCn: "上面", meaningEn: "up" },
  { char: "十", pinyin: "shí", meaningCn: "数字10", meaningEn: "ten" },
  { char: "是", pinyin: "shì", meaningCn: "是非", meaningEn: "is" },
  { char: "书", pinyin: "shū", meaningCn: "书本", meaningEn: "book" },
  { char: "水", pinyin: "shuǐ", meaningCn: "喝水", meaningEn: "water" },
  { char: "四", pinyin: "sì", meaningCn: "数字4", meaningEn: "four" },
  { char: "他", pinyin: "tā", meaningCn: "男性他", meaningEn: "he" },
  { char: "她", pinyin: "tā", meaningCn: "女性她", meaningEn: "she" },
  { char: "天", pinyin: "tiān", meaningCn: "天空", meaningEn: "sky" },
  { char: "听", pinyin: "tīng", meaningCn: "听讲", meaningEn: "listen" },
  { char: "我", pinyin: "wǒ", meaningCn: "我们", meaningEn: "me" },
  { char: "五", pinyin: "wǔ", meaningCn: "数字5", meaningEn: "five" },
  { char: "小", pinyin: "xiǎo", meaningCn: "微小", meaningEn: "small" },
  { char: "写", pinyin: "xiě", meaningCn: "写字", meaningEn: "write" },
  { char: "学", pinyin: "xué", meaningCn: "学习", meaningEn: "study" },
  { char: "一", pinyin: "yī", meaningCn: "数字1", meaningEn: "one" },
  { char: "有", pinyin: "yǒu", meaningCn: "拥有", meaningEn: "have" },
  { char: "月", pinyin: "yuè", meaningCn: "月亮", meaningEn: "moon" },
  { char: "在", pinyin: "zài", meaningCn: "正在", meaningEn: "at" },
  { char: "这", pinyin: "zhè", meaningCn: "这里", meaningEn: "this" },
  { char: "中", pinyin: "zhōng", meaningCn: "中国", meaningEn: "middle" },
  { char: "字", pinyin: "zì", meaningCn: "汉字", meaningEn: "word" },
  { char: "做", pinyin: "zuò", meaningCn: "做事", meaningEn: "do" },
  { char: "坐", pinyin: "zuò", meaningCn: "坐下", meaningEn: "sit" }
];
