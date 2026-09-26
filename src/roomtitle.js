/**
 * 进入房间时在画面正中央显示的大标题（房间名 + 英文小字），
 * 约 1.6 秒内淡出。可在设置里关闭。
 */
export function createRoomTitle({ zones }) {
  const el = document.getElementById('room-title');
  let enabled = false;
  let currentId = '';
  let timer = 0;

  function hide() {
    el.classList.add('hidden');
    el.classList.remove('show');
  }

  function setEnabled(value) {
    enabled = Boolean(value);
    if (!enabled) hide();
  }

  function show(zone) {
    el.innerHTML = `<span>${zone.sub ?? ''}</span><strong>${zone.name}</strong>`;
    el.classList.remove('hidden');
    el.classList.remove('show');
    void el.offsetWidth; // 强制回流以重启动画
    el.classList.add('show');
    timer = 1.7;
  }

  function update(dt, position) {
    const zone =
      zones.find(
        (item) =>
          position.x >= item.rect[0] &&
          position.x <= item.rect[1] &&
          position.z >= item.rect[2] &&
          position.z <= item.rect[3],
      ) ?? null;
    const id = zone?.id ?? '';

    if (id !== currentId) {
      currentId = id;
      if (zone && enabled) show(zone);
    }

    if (timer > 0) {
      timer -= dt;
      if (timer <= 0) hide();
    }
  }

  return { setEnabled, isEnabled: () => enabled, update };
}
