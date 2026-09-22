/** 键鼠输入：键盘移动、鼠标转向（指针锁定，失败时退化为按住拖动） */
export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = new Set();
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.pointerLocked = false;
    this.dragging = false;
    this.enabled = true;
    this.jumpQueued = false;
    this.onLockChange = () => {};

    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      if (event.code === 'Space') {
        this.jumpQueued = true;
        event.preventDefault();
      }
      if (MOVEMENT_KEYS[event.code] || event.code === 'Space') event.preventDefault();
      this.keys.add(event.code);
    });

    window.addEventListener('keyup', (event) => {
      this.keys.delete(event.code);
    });

    window.addEventListener('blur', () => {
      this.keys.clear();
      this.dragging = false;
    });

    canvas.addEventListener('mousedown', () => {
      this.dragging = true;
      if (!this.pointerLocked) this.requestLock();
    });

    window.addEventListener('mouseup', () => {
      this.dragging = false;
    });

    window.addEventListener('mousemove', (event) => {
      if (this.pointerLocked || this.dragging) {
        this.mouseDX += event.movementX || 0;
        this.mouseDY += event.movementY || 0;
      }
    });

    document.addEventListener('pointerlockchange', () => {
      this.pointerLocked = document.pointerLockElement === this.canvas;
      this.onLockChange(this.pointerLocked);
    });

    document.addEventListener('pointerlockerror', () => {
      this.pointerLocked = false;
      this.onLockChange(false);
    });

    canvas.addEventListener('contextmenu', (event) => event.preventDefault());
  }

  requestLock() {
    // 面板打开时不抢锁定，避免点一下就重新锁住指针
    if (!this.enabled) return;
    if (document.pointerLockElement === this.canvas) return;
    const result = this.canvas.requestPointerLock?.();
    if (result && typeof result.catch === 'function') result.catch(() => {});
  }

  exitLock() {
    if (document.pointerLockElement === this.canvas) document.exitPointerLock();
  }

  /** 取走并清空本帧累积的鼠标位移 */
  consumeMouseDelta() {
    const delta = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0;
    this.mouseDY = 0;
    return delta;
  }

  consumeJump() {
    const queued = this.jumpQueued;
    this.jumpQueued = false;
    return queued;
  }

  /** 返回归一化的移动意图：x 为右方，z 为前方 */
  movement() {
    if (!this.enabled) return { x: 0, z: 0, run: false };

    let x = 0;
    let z = 0;
    if (this.isDown('KeyW', 'ArrowUp')) z += 1;
    if (this.isDown('KeyS', 'ArrowDown')) z -= 1;
    if (this.isDown('KeyD', 'ArrowRight')) x += 1;
    if (this.isDown('KeyA', 'ArrowLeft')) x -= 1;

    const length = Math.hypot(x, z);
    if (length > 1) {
      x /= length;
      z /= length;
    }

    return { x, z, run: this.isDown('ShiftLeft', 'ShiftRight') };
  }

  isDown(...codes) {
    return codes.some((code) => this.keys.has(code));
  }
}

const MOVEMENT_KEYS = {
  KeyW: 1,
  KeyA: 1,
  KeyS: 1,
  KeyD: 1,
  ArrowUp: 1,
  ArrowDown: 1,
  ArrowLeft: 1,
  ArrowRight: 1,
};
