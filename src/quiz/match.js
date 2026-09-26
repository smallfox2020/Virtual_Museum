/**
 * 答案匹配：简繁归一、别名库、关键词、模糊（错别字）容错。
 * 用于「进阶 / 大师」的输入作答。
 */

/* 常见繁体 → 简体字表（覆盖馆内展品名与常见用字） */
const TRAD_TO_SIMP = {
  劍: '剑', 簡: '简', 盤: '盘', 蓮: '莲', 紋: '纹', 銅: '铜', 鏡: '镜', 獸: '兽',
  鳥: '鸟', 鎮: '镇', 國: '国', 雲: '云', 夢: '梦', 編: '编', 鐘: '钟', 踐: '践',
  嶺: '岭', 臥: '卧', 鉞: '钺', 錯: '错', 壺: '壶', 鑑: '鉴', 這: '这', 個: '个',
  們: '们', 來: '来', 說: '说', 時: '时', 東: '东', 車: '车', 貝: '贝', 見: '见',
  長: '长', 門: '门', 馬: '马', 魚: '鱼', 韓: '韩', 風: '风', 飛: '飞', 龍: '龙',
  龜: '龟', 與: '与', 為: '为', 無: '无', 萬: '万', 華: '华', 學: '学', 會: '会',
  體: '体', 點: '点', 電: '电', 語: '语', 讀: '读', 書: '书', 寫: '写', 樂: '乐',
  禮: '礼', 器: '器', 圖: '图', 館: '馆', 髮: '发', 裏: '里', 麵: '面', 葉: '叶',
  陽: '阳', 陰: '阴', 臺: '台', 灣: '湾', 陝: '陕', 隨: '随', 縣: '县', 鄉: '乡',
  戰: '战', 爭: '争', 車: '车', 軍: '军', 將: '将', 師: '师', 傳: '传', 倫: '伦',
  價: '价', 億: '亿', 儀: '仪', 劍: '剑', 劃: '划', 劉: '刘', 動: '动', 務: '务',
  勝: '胜', 區: '区', 醫: '医', 華: '华', 單: '单', 賣: '卖', 買: '买', 貴: '贵',
  費: '费', 資: '资', 質: '质', 農: '农', 邊: '边', 過: '过', 運: '运', 達: '达',
  遠: '远', 適: '适', 選: '选', 遺: '遗', 鄉: '乡', 醫: '医', 釋: '释', 鑑: '鉴',
  鑄: '铸', 範: '范', 節: '节', 築: '筑', 籃: '篮', 籤: '签', 簽: '签', 紅: '红',
  綠: '绿', 藍: '蓝', 銀: '银', 鐵: '铁', 鋼: '钢', 織: '织', 繡: '绣', 繼: '继',
};

/** 繁体转简体（逐字查表，未收录的原样保留） */
export function toSimplified(text) {
  let output = '';
  for (const char of String(text ?? '')) output += TRAD_TO_SIMP[char] ?? char;
  return output;
}

/** 归一化：转简体 → 转小写 → 去掉空白与标点 */
export function normalize(text) {
  return toSimplified(text)
    .toLowerCase()
    .replace(/[\s·、，,。.「」“”"'（）()【】\[\]《》!！?？:：;；-]/g, '');
}

/** 编辑距离 */
export function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(prev[j] + 1, current[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = current;
  }
  return prev[b.length];
}

/** 相似度 0~1（1 表示完全相同） */
export function similarity(a, b) {
  const max = Math.max(a.length, b.length);
  return max === 0 ? 1 : 1 - levenshtein(a, b) / max;
}

/**
 * 判断玩家输入是否命中某道谜题。
 * 依次尝试：精确 → 包含 → 别名 → 关键词 → 模糊容错（错别字）。
 */
export function matchesAnswer(guess, puzzle) {
  const value = normalize(guess);
  if (!value) return false;

  const candidates = [puzzle.name, ...(puzzle.aliases ?? [])].map(normalize).filter(Boolean);

  for (const candidate of candidates) {
    if (value === candidate) return true;
    if (value.length >= 2 && (candidate.includes(value) || value.includes(candidate))) return true;
  }

  for (const keyword of puzzle.keywords ?? []) {
    const key = normalize(keyword);
    if (key && value.includes(key)) return true;
  }

  // 错别字容错：长度 3 以内允许 1 个字的差异，更长允许 2 个
  for (const candidate of candidates) {
    const tolerance = candidate.length <= 3 ? 1 : 2;
    if (Math.abs(candidate.length - value.length) <= tolerance && levenshtein(value, candidate) <= tolerance) {
      return true;
    }
    if (similarity(value, candidate) >= 0.72) return true;
  }

  return false;
}
