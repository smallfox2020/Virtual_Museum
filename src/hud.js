/** 负责 HUD 上的提示、展品信息面板与状态文字 */
export function createHud() {
  const hud = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const resume = document.getElementById('resume');
  const prompt = document.getElementById('prompt');
  const panel = document.getElementById('panel');
  const panelTag = document.getElementById('panel-tag');
  const panelTitle = document.getElementById('panel-title');
  const panelDesc = document.getElementById('panel-desc');
  const stats = document.getElementById('stats');

  let panelOpen = false;
  let locked = false;
  let started = false;

  /** 只有「还没开始」时才显示大遮罩；之后只显示一行小提示 */
  function applyOverlay() {
    overlay.classList.toggle('hidden', locked || started || panelOpen);
    resume.classList.toggle('hidden', locked || !started || panelOpen);
  }

  return {
    isPanelOpen() {
      return panelOpen;
    },

    setLocked(value) {
      locked = value;
      hud.classList.toggle('pointer-locked', value);
      applyOverlay();
    },

    /** 第一次进入场景之后，遮罩不再自动弹出 */
    markStarted() {
      started = true;
      applyOverlay();
    },

    setPrompt(item) {
      if (!item || panelOpen) {
        prompt.classList.add('hidden');
        return;
      }
      prompt.innerHTML = item.model
        ? `按 <kbd>E</kbd> 查看《${item.title}》 · <kbd>O</kbd> 观察`
        : `按 <kbd>E</kbd> 查看《${item.title}》`;
      prompt.classList.remove('hidden');
    },

    showInfo(item) {
      panelOpen = true;
      panelTag.textContent = item.tag;
      panelTitle.textContent = item.title;
      panelDesc.textContent = item.desc;
      panel.classList.remove('hidden');
      prompt.classList.add('hidden');
      applyOverlay();
    },

    hideInfo() {
      panelOpen = false;
      panel.classList.add('hidden');
      applyOverlay();
    },

    setStats(text) {
      stats.textContent = text;
    },
  };
}
