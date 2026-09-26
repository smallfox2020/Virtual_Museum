import { matchesAnswer, normalize } from './match.js';
import { createQuizState, LEVELS, BADGES } from './state.js';

/**
 * 展品侦探：以「翻开线索 → 推理 → 猜展品」为核心的猜谜小游戏。
 *
 * 玩法：局部猜全 / 剪影猜物 / 声音猜物 / 线索卡牌 / 展厅寻宝 / 真假策展人
 * 难度：新手（四选一·3 线索）/ 进阶（输入名称·3 线索）/ 大师（只看局部或听声音·2 线索）/ 专家（3D 展厅寻找）
 * 防挫败：一错排除一个选项，二错自动翻下一条线索，三错直接给答案但只给基础分。
 */

const MODES = [
  { id: 'clue', name: '线索卡牌', desc: '只给谜面，靠翻开线索一步步推理。' },
  { id: 'partial', name: '局部猜全', desc: '先看展品的一个局部放大图，猜出整件器物。' },
  { id: 'silhouette', name: '剪影猜物', desc: '只看黑色剪影，猜出它是什么。' },
  { id: 'sound', name: '声音猜物', desc: '闭上眼睛听谜面朗读，再作答。' },
  { id: 'hunt', name: '展厅寻宝', desc: '根据线索在 3D 展厅里找到并走近展品，按 E 确认。' },
  { id: 'curator', name: '真假策展人', desc: '判断策展人的说法是真是假。' },
];

const DIFFICULTIES = [
  { id: 'novice', name: '新手', desc: '四选一 · 可翻 3 条线索', answers: 'choice', clues: 3 },
  { id: 'advanced', name: '进阶', desc: '输入名称（支持别名与错别字）· 3 条线索', answers: 'input', clues: 3 },
  { id: 'master', name: '大师', desc: '只看局部或听声音 · 2 条线索', answers: 'choice', clues: 2 },
  { id: 'expert', name: '专家', desc: '在 3D 展厅里寻找并走近展品 · 2 条线索', answers: 'hunt', clues: 2 },
];

const BASE_SCORE = 100;
const CLUE_COST = 20;
const WRONG_COST = 10;
const MIN_SCORE = 20;

export function createQuiz({ puzzles, thumbnail, speak, onReveal, onSpatialHint, onOpen, onClose }) {
  const $ = (id) => document.getElementById(id);

  const root = $('quiz');
  const menuEl = $('quiz-menu');
  const roundEl = $('quiz-round');
  const codexEl = $('quiz-codex');
  const modesEl = $('quiz-modes');
  const levelsEl = $('quiz-levels');
  const menuDesc = $('quiz-menu-desc');
  const menuStats = $('quiz-menu-stats');
  const roundModeEl = $('quiz-round-mode');
  const roundTitle = $('quiz-round-title');
  const roundScore = $('quiz-round-score');
  const roundStreak = $('quiz-round-streak');
  const roundLevel = $('quiz-round-level');
  const visualEl = $('quiz-visual');
  const imageEl = $('quiz-image');
  const visualBadge = $('quiz-visual-badge');
  const riddleEl = $('quiz-riddle');
  const cluesEl = $('quiz-clues');
  const answerEl = $('quiz-answer');
  const feedbackEl = $('quiz-feedback');
  const hintBtn = $('quiz-hint');
  const revealBtn = $('quiz-reveal');
  const nextBtn = $('quiz-next');
  const quitBtn = $('quiz-quit');
  const codexGrid = $('quiz-codex-grid');
  const codexProgress = $('quiz-codex-progress');
  const badgesEl = $('quiz-badges');
  const toastEl = $('quiz-toast');

  const state = createQuizState();

  let open = false;
  let view = 'menu';
  let mode = 'clue';
  let difficulty = 'novice';
  let round = null;
  let challengeNo = 0;
  let lastId = '';
  let toastTimer = 0;

  const byId = (id) => puzzles.find((p) => p.id === id);

  function toast(text) {
    toastEl.textContent = text;
    toastEl.classList.remove('hidden');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.add('hidden'), 1800);
  }

  function currentLevel() {
    return state.level();
  }

  function refreshStats() {
    const level = currentLevel();
    menuStats.textContent = `图鉴 ${state.unlockedCount()} / ${puzzles.length} · 积分 ${state.score()} · 最佳连胜 ${state.bestStreak()} · 每日连胜 ${state.dailyStreak()} · ${level.icon} ${level.name}`;
  }

  /* ---------------- 菜单 ---------------- */

  function renderMenu() {
    view = 'menu';
    menuEl.classList.remove('hidden');
    roundEl.classList.add('hidden');
    codexEl.classList.add('hidden');
    root.classList.remove('hunt');

    modesEl.innerHTML = '';
    for (const item of MODES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${item.id === mode ? ' active' : ''}`;
      chip.textContent = item.name;
      chip.addEventListener('click', () => {
        mode = item.id;
        renderMenu();
      });
      modesEl.append(chip);
    }

    levelsEl.innerHTML = '';
    for (const item of DIFFICULTIES) {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `chip${item.id === difficulty ? ' active' : ''}`;
      chip.textContent = item.name;
      chip.addEventListener('click', () => {
        difficulty = item.id;
        renderMenu();
      });
      levelsEl.append(chip);
    }

    const m = MODES.find((item) => item.id === mode);
    const d = DIFFICULTIES.find((item) => item.id === difficulty);
    menuDesc.textContent = `${m.name}：${m.desc}　·　${d.name}：${d.desc}`;
    refreshStats();
  }

  /* ---------------- 选一道题 ---------------- */

  function pickPuzzle(daily) {
    if (daily) {
      const index = [...new Date().toISOString().slice(0, 10)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
      return puzzles[index % puzzles.length];
    }
    const pool = puzzles.filter((p) => p.id !== lastId);
    const fresh = pool.filter((p) => !state.isUnlocked(p.id));
    const source = fresh.length ? fresh : pool;
    return source[Math.floor(Math.random() * source.length)] ?? puzzles[0];
  }

  /* ---------------- 一局 ---------------- */

  function startRound(daily = false) {
    const puzzle = pickPuzzle(daily);
    lastId = puzzle.id;
    challengeNo += 1;

    const effective = DIFFICULTIES.find((item) => item.id === difficulty);
    const isHunt = mode === 'hunt' || effective.answers === 'hunt';
    const answerType = isHunt ? 'hunt' : mode === 'curator' ? 'truefalse' : effective.answers;
    const clueLimit = Math.min(puzzle.clues.length, effective.clues);

    round = {
      puzzle,
      daily,
      isHunt,
      answerType,
      clueLimit,
      revealed: new Set(),
      paidClues: 0,
      eliminated: new Set(),
      wrongs: 0,
      finished: false,
      claim: answerType === 'truefalse' ? buildClaim(puzzle) : null,
    };

    view = 'round';
    menuEl.classList.add('hidden');
    codexEl.classList.add('hidden');
    roundEl.classList.remove('hidden');
    feedbackEl.classList.add('hidden');
    nextBtn.classList.add('hidden');
    root.classList.toggle('hunt', isHunt);

    roundModeEl.textContent = `${MODES.find((item) => item.id === mode).name}${daily ? ' · 每日一猜' : ''}`;
    roundTitle.textContent = `第 ${challengeNo} 案 · ${effective.name}难度`;
    refreshHud();

    renderVisual();
    riddleEl.textContent = puzzle.riddle;
    renderClues();
    renderAnswer();

    if (isHunt) {
      riddleEl.textContent = `${puzzle.riddle}\n\n在展厅里找到它，走近后按 E 确认。`;
    }
    if (mode === 'sound') speak?.(puzzle.riddle);
  }

  function refreshHud() {
    roundScore.textContent = state.score();
    roundStreak.textContent = state.streak();
    roundLevel.textContent = currentLevel().name;
  }

  function renderVisual() {
    const { puzzle, answerType } = round;
    const showImage = mode === 'partial' || mode === 'silhouette';
    visualEl.className = 'quiz-visual';
    if (showImage) {
      visualEl.classList.add(mode === 'partial' ? 'mode-partial' : 'mode-silhouette');
      visualEl.classList.add('has-image');
      imageEl.src = thumbnail(puzzle);
      imageEl.style.objectPosition = mode === 'partial'
        ? `${20 + Math.random() * 60}% ${20 + Math.random() * 60}%`
        : '50% 50%';
      visualBadge.textContent = '';
    } else {
      visualEl.classList.add(answerType === 'hunt' ? 'mode-hunt' : mode === 'sound' ? 'mode-sound' : 'mode-clue');
      imageEl.removeAttribute('src');
      visualBadge.textContent = mode === 'sound' ? '🔊' : '？';
    }
  }

  function buildClaim(puzzle) {
    const fields = [
      ['era', '年代'],
      ['origin', '出土地'],
      ['material', '材质'],
      ['use', '用途'],
    ];
    const [field, label] = fields[Math.floor(Math.random() * fields.length)];
    const others = puzzles.filter((p) => p.id !== puzzle.id);
    const fake = Math.random() < 0.5;
    const value = fake ? others[Math.floor(Math.random() * others.length)][field] : puzzle[field];
    return { text: `策展人说：「${puzzle.name} 的${label}是「${value}」。」`, fake };
  }

  function renderClues() {
    cluesEl.innerHTML = '';
    round.puzzle.clues.slice(0, round.clueLimit).forEach((clue, index) => {
      const card = document.createElement('div');
      card.className = `quiz-clue${round.revealed.has(index) ? ' flipped' : ''}`;
      card.innerHTML = `
        <div class="quiz-clue-inner">
          <div class="quiz-clue-face quiz-clue-front">线索 ${index + 1} · 点击翻开</div>
          <div class="quiz-clue-face quiz-clue-back">
            <span class="quiz-clue-label">${clue.label}</span>
            <span class="quiz-clue-text">${clue.text}</span>
          </div>
        </div>`;
      card.addEventListener('click', () => revealClue(index, true));
      cluesEl.append(card);
    });
  }

  function revealClue(index, paid) {
    if (round.finished || round.revealed.has(index)) return;
    round.revealed.add(index);
    if (paid) round.paidClues += 1;
    const card = cluesEl.children[index];
    card?.classList.add('flipped');
    if (paid) toast(`翻开线索 -${CLUE_COST} 分`);
    updateHintButton();
  }

  function nextUnrevealedIndex() {
    for (let i = 0; i < round.clueLimit; i += 1) if (!round.revealed.has(i)) return i;
    return -1;
  }

  function updateHintButton() {
    hintBtn.disabled = round.finished || nextUnrevealedIndex() < 0;
  }

  function renderAnswer() {
    answerEl.innerHTML = '';
    if (round.finished) return;

    if (round.answerType === 'choice') renderChoice();
    else if (round.answerType === 'input') renderInput();
    else if (round.answerType === 'hunt') renderHunt();
    else if (round.answerType === 'truefalse') renderTrueFalse();

    updateHintButton();
  }

  function renderChoice() {
    const options = [...round.puzzle.options].sort(() => Math.random() - 0.5);
    const grid = document.createElement('div');
    grid.className = 'quiz-options';
    options.forEach((option) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `quiz-option${round.eliminated.has(option) ? ' eliminated' : ''}`;
      btn.textContent = option;
      btn.addEventListener('click', () => {
        if (round.finished) return;
        if (option === round.puzzle.answer) {
          btn.classList.add('correct');
          finish(true);
        } else {
          btn.classList.add('wrong');
          handleWrong();
        }
      });
      grid.append(btn);
    });
    answerEl.append(grid);
  }

  function renderInput() {
    const row = document.createElement('div');
    row.className = 'quiz-input-row';
    const input = document.createElement('input');
    input.id = 'quiz-input';
    input.type = 'text';
    input.placeholder = '输入展品名称（支持别名 / 简繁 / 错别字）';
    input.autocomplete = 'off';
    const submit = document.createElement('button');
    submit.type = 'button';
    submit.className = 'quiz-primary';
    submit.textContent = '提交';
    const attempt = () => {
      if (round.finished) return;
      const value = input.value;
      if (!value.trim()) return;
      if (matchesAnswer(value, round.puzzle)) finish(true);
      else handleWrong(input);
    };
    submit.addEventListener('click', attempt);
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        attempt();
      }
      // 允许 Esc 冒泡给全局按键处理，其余按键不要触发展厅操作
      if (event.key !== 'Escape') event.stopPropagation();
    });
    row.append(input, submit);
    answerEl.append(row);
    setTimeout(() => input.focus(), 30);
  }

  function renderHunt() {
    const note = document.createElement('p');
    note.className = 'quiz-note';
    note.textContent = '线索已给出，去 3D 展厅里找到这件展品，走近后按 E 确认。';
    const locate = document.createElement('button');
    locate.type = 'button';
    locate.textContent = '给我方位提示';
    locate.addEventListener('click', () => {
      const hint = onSpatialHint?.(round.puzzle.name);
      showFeedback(`<h4>方位</h4>${hint ?? '它在展厅的某个展台上。'}`, 'bad');
    });
    answerEl.append(note, locate);
  }

  function renderTrueFalse() {
    const claim = document.createElement('p');
    claim.className = 'quiz-note';
    claim.textContent = round.claim.text;
    const row = document.createElement('div');
    row.className = 'quiz-input-row';
    for (const [label, value] of [['真', true], ['假', false]]) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'quiz-option';
      btn.textContent = label;
      btn.addEventListener('click', () => {
        if (round.finished) return;
        const correct = value !== round.claim.fake;
        btn.classList.add(correct ? 'correct' : 'wrong');
        if (correct) finish(true);
        else handleWrong();
      });
      row.append(btn);
    }
    answerEl.append(claim, row);
  }

  /* ---------------- 判题 ---------------- */

  function handleWrong(input) {
    if (round.finished) return;
    round.wrongs += 1;

    if (round.wrongs === 1) {
      if (round.answerType === 'choice') {
        const wrongOptions = round.puzzle.options.filter((o) => o !== round.puzzle.answer && !round.eliminated.has(o));
        if (wrongOptions.length) {
          round.eliminated.add(wrongOptions[Math.floor(Math.random() * wrongOptions.length)]);
          renderAnswer();
        }
        showFeedback('<h4>再想想</h4>已经帮你排除掉一个错误选项。', 'bad');
      } else {
        const answer = normalize(round.puzzle.answer);
        showFeedback(
          `<h4>很接近了</h4>答案有 ${round.puzzle.answer.length} 个字，以「${round.puzzle.answer[0]}」开头。`,
          'bad',
        );
      }
    } else if (round.wrongs === 2) {
      const index = nextUnrevealedIndex();
      if (index >= 0) revealClue(index, false);
      showFeedback('<h4>换条线索</h4>免费帮你翻开下一条线索，再看看。', 'bad');
    } else {
      showFeedback('<h4>答案揭晓</h4>没关系，认识它才是重点。', 'bad');
      finish(false, true);
      return;
    }

    if (input?.value !== undefined) input.value = '';
  }

  function finish(correct, forced = false) {
    if (round.finished) return;
    round.finished = true;
    root.classList.remove('hunt');

    const { puzzle } = round;
    const streakBefore = state.streak();
    let gained;
    if (forced) {
      gained = MIN_SCORE;
    } else {
      gained = Math.max(MIN_SCORE, BASE_SCORE - round.paidClues * CLUE_COST - round.wrongs * WRONG_COST);
      if (correct) gained += Math.min(streakBefore * 10, 50);
    }

    state.recordRound({
      puzzleId: puzzle.id,
      gained,
      correct,
      cluesUsed: round.paidClues,
      wrongs: round.wrongs,
    });
    if (round.daily && correct) state.registerDaily();
    refreshHud();

    const fun = puzzle.funFact ? `<p class="fun">💡 ${puzzle.funFact}</p>` : '';
    const answerLine = `<p><b>答案：${puzzle.answer}</b> · ${puzzle.era} · ${puzzle.origin}</p>`;
    const head = correct ? `🎉 答对了！本题 +${gained} 分` : `本题得基础分 ${gained}`;
    showFeedback(
      `<h4>${head}</h4>${answerLine}<p>${puzzle.explanation}</p>${fun}`,
      correct ? 'ok' : 'bad',
    );

    answerEl.innerHTML = '';
    nextBtn.classList.remove('hidden');
    hintBtn.disabled = true;
    revealBtn.disabled = true;

    if (correct) onReveal?.(puzzle);
  }

  function showFeedback(html, kind) {
    feedbackEl.className = `quiz-feedback ${kind}`;
    feedbackEl.innerHTML = html;
    feedbackEl.classList.remove('hidden');
  }

  /* ---------------- 图鉴 ---------------- */

  function renderCodex() {
    view = 'codex';
    menuEl.classList.add('hidden');
    roundEl.classList.add('hidden');
    codexEl.classList.remove('hidden');
    root.classList.remove('hunt');

    codexProgress.textContent = `已解锁 ${state.unlockedCount()} / ${puzzles.length} 件展品`;
    badgesEl.innerHTML = '';
    const earned = new Set(state.badges(puzzles).map((b) => b.id));
    for (const badge of BADGES) {
      const span = document.createElement('span');
      span.className = `quiz-badge${earned.has(badge.id) ? ' earned' : ''}`;
      span.textContent = `${earned.has(badge.id) ? '🏅' : '🔒'} ${badge.name}`;
      span.title = badge.desc;
      badgesEl.append(span);
    }

    codexGrid.innerHTML = '';
    for (const puzzle of puzzles) {
      const unlocked = state.isUnlocked(puzzle.id);
      const card = document.createElement('div');
      card.className = `codex-card${unlocked ? '' : ' locked'}`;
      if (unlocked) {
        const img = document.createElement('img');
        img.src = thumbnail(puzzle);
        img.alt = puzzle.name;
        card.append(img);
      } else {
        const lock = document.createElement('div');
        lock.className = 'codex-lock';
        lock.textContent = '？';
        card.append(lock);
      }
      const title = document.createElement('h4');
      title.textContent = unlocked ? puzzle.name : '未解锁';
      const sub = document.createElement('p');
      sub.textContent = unlocked ? `${puzzle.category} · ${puzzle.era}` : '答对后解锁';
      card.append(title, sub);
      if (unlocked) {
        card.title = puzzle.explanation;
        card.addEventListener('click', () => speak?.(`${puzzle.name}。${puzzle.explanation}`));
      }
      codexGrid.append(card);
    }
  }

  function share() {
    const level = currentLevel();
    const badgeNames = state.badges(puzzles).map((b) => b.name).join('、') || '暂无';
    const text = `【展品侦探】我已解锁 ${state.unlockedCount()}/${puzzles.length} 件展品，积分 ${state.score()}，最佳连胜 ${state.bestStreak()}，${level.name}，徽章：${badgeNames}。来湖北省博物馆虚拟展厅一起猜展品吧！`;
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(
        () => toast('成绩已复制到剪贴板'),
        () => toast(text),
      );
    } else {
      toast(text);
    }
  }

  /* ---------------- 对外接口 ---------------- */

  function openQuiz() {
    open = true;
    root.classList.remove('hidden');
    renderMenu();
    onOpen?.();
  }

  function closeQuiz() {
    open = false;
    root.classList.add('hidden');
    root.classList.remove('hunt');
    round = null;
    onClose?.();
  }

  function backToMenu() {
    round = null;
    renderMenu();
  }

  function isHunting() {
    return Boolean(open && round && round.isHunt && !round.finished);
  }

  function handleKey(code) {
    if (!open) return false;
    if (code === 'Escape') {
      // 无论在哪一层，Esc 都直接退出猜谜，返回展厅
      closeQuiz();
      return true;
    }
    return false;
  }

  /** 展厅寻宝：玩家在 3D 里按 E 点中的展品 */
  function tryHuntAnswer(item) {
    if (!isHunting() || !item) return false;
    const title = item.title ?? '';
    if (matchesAnswer(title, round.puzzle)) {
      finish(true);
      return true;
    }
    if (title === round.puzzle.name) {
      finish(true);
      return true;
    }
    // 点错了：给空间方位提示，不重罚
    round.wrongs += 1;
    const hint = onSpatialHint?.(round.puzzle.name) ?? '再往展厅深处找找。';
    if (round.wrongs >= 3) {
      showFeedback(`<h4>答案揭晓</h4><p>它是「${round.puzzle.answer}」。${hint}</p>`, 'bad');
      finish(false, true);
    } else if (round.wrongs === 2) {
      const index = nextUnrevealedIndex();
      if (index >= 0) revealClue(index, false);
      showFeedback(`<h4>不是这件</h4><p>${hint}</p><p>再免费给你一条线索。</p>`, 'bad');
    } else {
      showFeedback(`<h4>不是这件</h4><p>${hint}</p>`, 'bad');
    }
    return true;
  }

  /* ---------------- 事件绑定 ---------------- */

  $('quiz-start').addEventListener('click', () => startRound(false));
  $('quiz-daily').addEventListener('click', () => startRound(true));

  // 重置积分：不可撤销，所以先弹一次确认，并说清楚会清掉什么。
  // state.reset() 会同时清空积分、图鉴、连胜、每日记录与逐题统计。
  $('quiz-reset').addEventListener('click', () => {
    const ok = window.confirm('确定重置吗？\n\n积分、展品图鉴、连胜、每日一猜记录都会清空，无法恢复。');
    if (!ok) return;
    state.reset();
    renderMenu();   // 重新渲染菜单，顺手刷新底部的统计与等级
  });
  $('quiz-codex-open').addEventListener('click', renderCodex);
  $('quiz-close-x').addEventListener('click', closeQuiz);
  $('quiz-exit').addEventListener('click', closeQuiz);
  $('quiz-codex-back').addEventListener('click', backToMenu);
  $('quiz-share').addEventListener('click', share);
  $('quiz-next').addEventListener('click', () => startRound(round?.daily ?? false));
  $('quiz-quit').addEventListener('click', backToMenu);
  revealBtn.addEventListener('click', () => {
    if (!round || round.finished) return;
    finish(false, true);
  });
  hintBtn.addEventListener('click', () => {
    if (!round || round.finished) return;
    const index = nextUnrevealedIndex();
    if (index >= 0) revealClue(index, true);
  });

  /** 答对后的过场：隐藏答题 UI，让主场景播放“飞过去 → 3D 展示一圈 → 飞回来” */
  function setCinematic(value) {
    root.classList.toggle('cinematic', Boolean(value));
    // 过场结束、UI 恢复后，把结果解析滚动到可见位置
    if (!value) setTimeout(() => feedbackEl.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }), 80);
  }

  return {
    open: openQuiz,
    close: closeQuiz,
    isOpen: () => open,
    isHunting,
    blocksInput: () => open && !isHunting(),
    setCinematic,
    handleKey,
    tryHuntAnswer,
    getPuzzleCount: () => puzzles.length,
  };
}
