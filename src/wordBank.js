// ==========================================================================
// MQTT DRAW & GUESS - WORD BANK & CATEGORIES
// ==========================================================================

export const WORD_BANK = {
  food: [
    { word: "珍珠奶茶", hint: "人氣手搖飲料，裡面有黑黑Q彈的珍珠" },
    { word: "小籠包", hint: "湯汁飽滿的麵食，鼎泰豐招牌" },
    { word: "臭豆腐", hint: "外酥內嫩，聞起來特別的夜市美食" },
    { word: "牛肉麵", hint: "經典麵食，配上紅燒湯頭與厚切肉塊" },
    { word: "滷肉飯", hint: "淋上香濃肉燥與滷汁的國民美食" },
    { word: "章魚燒", hint: "日式小吃，圓圓的上面撒滿柴魚片" },
    { word: "大腸包小腸", hint: "糯米腸切開夾香腸" },
    { word: "芒果冰", hint: "夏天必吃的冰品，上面有黃色鮮果與煉乳" },
    { word: "蛋餅", hint: "早餐店經典，外皮煎得香酥切成一塊塊" },
    { word: "糖葫蘆", hint: "裹著透明糖衣的水果串" },
    { word: "壽司", hint: "日式醋飯搭配新鮮生魚片" },
    { word: "漢堡", hint: "兩片麵包夾著牛肉餅與生菜" },
    { word: "披薩", hint: "圓形烤餅，上面有滿滿起司與餡料" },
    { word: "炸雞", hint: "外皮金黃酥脆的家禽肉" },
    { word: "甜甜圈", hint: "中間有一個洞的油炸甜點" }
  ],
  anime: [
    { word: "皮卡丘", hint: "黃色會放電的寶可夢" },
    { word: "哆啦A夢", hint: "藍色貓型機器人，口袋裡有很多道具" },
    { word: "超級馬力歐", hint: "穿水電工吊帶褲、戴紅帽子踩蘑菇" },
    { word: "海賊王", hint: "戴草帽想要尋找 One Piece 的橡膠人" },
    { word: "蜘蛛人", hint: "被蜘蛛咬到後會噴絲爬牆的高中生" },
    { word: "鋼彈", hint: "巨大日本機器人動畫" },
    { word: "史努比", hint: "躺在紅色狗屋上面的白色小狗" },
    { word: "蝙蝠俠", hint: "高譚市的黑夜英雄，開著超級戰車" },
    { word: "龍貓", hint: "宮崎駿動畫中巨大的毛茸茸森林守護神" },
    { word: "孫悟空", hint: "七龍珠主角，會發射龜派氣功" },
    { word: "超人", hint: "穿著紅色內褲外穿與披風的氪星英雄" },
    { word: "米老鼠", hint: "迪士尼經典角色，戴著大圓耳朵" }
  ],
  animals: [
    { word: "企鵝", hint: "生活在南極、走路搖搖擺擺的鳥類" },
    { word: "水豚", hint: "喜歡泡溫泉、樣子非常療癒的大型齧齒類" },
    { word: "長頸鹿", hint: "脖子特別長、身上有斑紋的哺乳動物" },
    { word: "袋鼠", hint: "腹部有育兒袋、擅長跳躍的澳洲動物" },
    { word: "貓頭鷹", hint: "夜行性鳥類，眼睛大大的頭可以轉270度" },
    { word: "變色龍", hint: "會根據環境改變皮膚顏色的爬蟲類" },
    { word: "大熊貓", hint: "黑白相間、最喜歡吃竹子的動物" },
    { word: "章魚", hint: "有八條觸手、會噴墨汁的海底生物" },
    { word: "孔雀", hint: "會開屏展示美麗羽毛的鳥類" },
    { word: "海豚", hint: "智商極高、會在海上躍出水面的哺乳動物" },
    { word: "變色龍", hint: "眼睛能各自轉動、舌頭能吐很長的爬蟲類" },
    { word: "變形蟲", hint: "單細胞生物" }
  ],
  life: [
    { word: "洗衣機", hint: "家電，轉動衣服洗乾淨" },
    { word: "滾筒印章", hint: "蓋章用的文具" },
    { word: "掃地機器人", hint: "在地上自動跑來跑去吸灰塵的家電" },
    { word: "雨傘", hint: "下雨天打開用來遮雨的工具" },
    { word: "腳踏車", hint: "兩個輪子，靠雙腳踩踏板前進" },
    { word: "吹風機", hint: "洗完頭髮後用來吹乾的家電" },
    { word: "手錶", hint: "戴在手腕上看時間的物品" },
    { word: "耳機", hint: "戴在耳朵上聽音樂不會吵到別人的裝備" },
    { word: "微波爐", hint: "利用電磁波快速加熱食物的廚房家電" },
    { word: "手電筒", hint: "停電時拿在手上發光的照明工具" },
    { word: "馬桶", hint: "浴室裡用來上廁所的設備" },
    { word: "剪刀", hint: "兩片金屬交叉用來剪紙的文具" },
    { word: "太陽眼鏡", hint: "陽光強烈時戴在眼睛上防紫外線" },
    { word: "鬧鐘", hint: "早上會大聲叮鈴鈴叫你起床的鐘" }
  ]
};

// Avatars for player profile
export const AVATARS = ['🦊', '🐱', '🐶', '🐰', '🐼', '🦁', '🐸', '🦄', '🤖', '👾', '🚀', '🎨'];

/**
 * Get random 3 words from category
 * @param {string} category 
 * @returns {Array<{word: string, hint: string}>}
 */
export function getRandomWordOptions(category = 'all', count = 3) {
  let pool = [];
  if (category === 'all' || !WORD_BANK[category]) {
    Object.values(WORD_BANK).forEach(catWords => {
      pool.push(...catWords);
    });
  } else {
    pool = [...WORD_BANK[category]];
  }

  // Shuffle pool
  const shuffled = [...pool].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
}
