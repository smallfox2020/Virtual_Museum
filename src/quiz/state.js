/**
 * 展品侦探的成长数据：图鉴解锁、积分、连胜、每日一猜、等级与徽章。
 * 全部存在 localStorage 里，刷新页面不丢。
 */

const STORAGE_KEY = 'museum.quiz.v1';

const LEVELS = [
  { min: 0, name: '实习生', icon: '🎓' },
  { min: 3, name: '助理策展人', icon: '📋' },
  { min: 6, name: '策展人', icon: '🏛️' },
  { min: 10, name: '高级策展人', icon: '🎖️' },
  { min: 15, name: '馆长', icon: '👑' },
];

const BADGES = [
  { id: 'bronze', name: '青铜达人', desc: '解锁全部青铜器', category: '青铜器' },
  { id: 'ceramic', name: '陶瓷达人', desc: '解锁全部陶瓷', category: '陶瓷' },
  { id: 'lacquer', name: '漆木巧匠', desc: '解锁全部漆木器', category: '漆木' },
  { id: 'weapon', name: '越王传人', desc: '解锁全部兵器', category: '兵器' },
  { id: 'document', name: '简牍学者', desc: '解锁全部文书', category: '文书' },
  { id: 'master', name: '满堂彩', desc: '解锁全部展品', all: true },
];

const today = () => new Date().toISOString().slice(0, 10);

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    /* 忽略损坏的存档 */
  }
  return null;
}

export function createQuizState() {
  const saved = load() ?? {};
  const data = {
    unlocked: new Set(saved.unlocked ?? []),
    score: saved.score ?? 0,
    streak: saved.streak ?? 0,
    bestStreak: saved.bestStreak ?? 0,
    rounds: saved.rounds ?? 0,
    correct: saved.correct ?? 0,
    clueUses: saved.clueUses ?? 0,
    wrongs: saved.wrongs ?? 0,
    dailyDate: saved.dailyDate ?? '',
    dailyStreak: saved.dailyStreak ?? 0,
    // 记录每道题的提示使用率与错误率，供后续调难度
    perPuzzle: saved.perPuzzle ?? {},
  };

  function save() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ ...data, unlocked: [...data.unlocked] }),
      );
    } catch {
      /* 隐私模式等场景下忽略 */
    }
  }

  function level() {
    let current = LEVELS[0];
    for (const item of LEVELS) if (data.unlocked.size >= item.min) current = item;
    return current;
  }

  function badges(puzzles) {
    return BADGES.filter((badge) => {
      const pool = badge.all ? puzzles : puzzles.filter((p) => p.category === badge.category);
      if (!pool.length) return false;
      return pool.every((p) => data.unlocked.has(p.id));
    });
  }

  return {
    /** 是否已解锁某道题 */
    isUnlocked: (id) => data.unlocked.has(id),
    unlockedCount: () => data.unlocked.size,
    score: () => data.score,
    streak: () => data.streak,
    bestStreak: () => data.bestStreak,
    dailyStreak: () => data.dailyStreak,
    level,
    badges,
    progress: (total) => (total ? data.unlocked.size / total : 0),

    /** 记录一局结果，返回本次得分 */
    recordRound({ puzzleId, gained, correct, cluesUsed, wrongs }) {
      data.rounds += 1;
      data.score += gained;
      data.clueUses += cluesUsed;
      data.wrongs += wrongs;
      const entry = data.perPuzzle[puzzleId] ?? { plays: 0, correct: 0, clues: 0, wrongs: 0 };
      entry.plays += 1;
      entry.clues += cluesUsed;
      entry.wrongs += wrongs;
      if (correct) {
        entry.correct += 1;
        data.correct += 1;
        data.unlocked.add(puzzleId);
        data.streak += 1;
        data.bestStreak = Math.max(data.bestStreak, data.streak);
      } else {
        data.streak = 0;
      }
      data.perPuzzle[puzzleId] = entry;
      save();
      return gained;
    },

    /** 每日一猜：同一天只加一次连胜 */
    registerDaily() {
      const date = today();
      if (data.dailyDate === date) return data.dailyStreak;
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      data.dailyStreak = data.dailyDate === yesterday ? data.dailyStreak + 1 : 1;
      data.dailyDate = date;
      save();
      return data.dailyStreak;
    },

    reset() {
      data.unlocked.clear();
      data.score = 0;
      data.streak = 0;
      data.bestStreak = 0;
      data.rounds = 0;
      data.correct = 0;
      data.clueUses = 0;
      data.wrongs = 0;
      data.dailyDate = '';
      data.dailyStreak = 0;
      data.perPuzzle = {};
      save();
    },
  };
}

export { LEVELS, BADGES, today };
