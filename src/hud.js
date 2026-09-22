/** 负责 HUD 上的提示、展品信息面板与状态文字 */
export function createHud() {
  const hud = document.getElementById('hud');
  const overlay = document.getElementById('overlay');
  const prompt = document.getElementById('prompt');
  const panel = document.getElementById('panel');
  const panelTag = document.getElementById('panel-tag');
  const panelTitle = document.getElementById('panel-title');
  const panelDesc = document.getElementById('panel-desc');
  const stats = document.getElementById('stats');

  let panelOpen = false;

  return {
    isPanelOpen() {
      return panelOpen;
    },

    setLocked(locked) {
      hud.classList.toggle('pointer-locked', locked);
      if (!panelOpen) overlay.classList.toggle('hidden', locked);
    },

    setPrompt(item) {
      if (!item || panelOpen) {
        prompt.classList.add('hidden');
        return;
      }
      prompt.textContent = `按 E 查看《${item.title}》`;
      prompt.classList.remove('hidden');
    },

    showInfo(item) {
      panelOpen = true;
      panelTag.textContent = item.tag;
      panelTitle.textContent = item.title;
      panelDesc.textContent = item.desc;
      panel.classList.remove('hidden');
      prompt.classList.add('hidden');
      overlay.classList.add('hidden');
    },

    hideInfo() {
      panelOpen = false;
      panel.classList.add('hidden');
    },

    setStats(text) {
      stats.textContent = text;
    },
  };
}
