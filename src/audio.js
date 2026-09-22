/**
 * 背景音乐：不用任何音频素材，全部用 WebAudio 现场合成。
 * 五声音阶的拨弦 + 低频铺底 + 生成式混响，配上设置面板里的音量控制。
 */
export function createAudio() {
  const state = { volume: 0.45, playing: false };
  let ctx = null;
  let master = null;
  let wet = null;
  let padGain = null;
  let pad = [];
  let timer = null;
  let nextNoteAt = 0;

  // 五声音阶（宫商角徵羽）
  const SCALE = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
  const ROOT = 220;

  function ensure() {
    if (ctx) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioCtx();

    master = ctx.createGain();
    master.gain.value = state.volume * 0.65;
    master.connect(ctx.destination);

    // 生成一段指数衰减的噪声当年堂混响的脉冲响应
    const length = Math.floor(ctx.sampleRate * 2.4);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let channel = 0; channel < 2; channel += 1) {
      const data = impulse.getChannelData(channel);
      for (let i = 0; i < length; i += 1) {
        data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2.6;
      }
    }
    const reverb = ctx.createConvolver();
    reverb.buffer = impulse;
    wet = ctx.createGain();
    wet.gain.value = 0.45;
    wet.connect(reverb);
    reverb.connect(master);

    padGain = ctx.createGain();
    padGain.gain.value = 0;
    padGain.connect(master);
    padGain.connect(wet);
  }

  function pluck(frequency, time, level) {
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + 2.6);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 2400;
    filter.Q.value = 0.6;

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(master);
    filter.connect(wet);
    osc.start(time);
    osc.stop(time + 2.8);
  }

  function schedule() {
    const ahead = ctx.currentTime + 1.2;
    while (nextNoteAt < ahead) {
      const degree = SCALE[Math.floor(Math.random() * SCALE.length)];
      const octave = Math.random() < 0.22 ? 0.5 : 1;
      pluck(ROOT * octave * 2 ** (degree / 12), Math.max(nextNoteAt, ctx.currentTime + 0.05), 0.1 + Math.random() * 0.12);
      nextNoteAt += 0.6 + Math.random() * 1.7;
    }
  }

  function start() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    if (state.playing) return;
    state.playing = true;

    pad = [ROOT / 4, (ROOT * 1.5) / 4, (ROOT * 9) / 8 / 2].map((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      gain.gain.value = 0.09;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.05 + index * 0.023;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.045;
      lfo.connect(lfoGain);
      lfoGain.connect(gain.gain);
      osc.connect(gain);
      gain.connect(padGain);
      osc.start();
      lfo.start();
      return { osc, lfo };
    });

    padGain.gain.cancelScheduledValues(ctx.currentTime);
    padGain.gain.setTargetAtTime(0.5, ctx.currentTime, 1.6);
    nextNoteAt = ctx.currentTime + 0.3;
    schedule();
    timer = setInterval(schedule, 400);
  }

  function stop() {
    state.playing = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (!ctx) return;
    padGain.gain.cancelScheduledValues(ctx.currentTime);
    padGain.gain.setTargetAtTime(0, ctx.currentTime, 0.4);
    const dying = pad;
    pad = [];
    setTimeout(() => {
      for (const { osc, lfo } of dying) {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          /* 已经停了 */
        }
      }
    }, 2400);
  }

  return {
    toggle() {
      if (state.playing) stop();
      else start();
      return state.playing;
    },
    start,
    stop,
    isPlaying: () => state.playing,
    setVolume(value) {
      state.volume = Math.min(1, Math.max(0, value));
      if (master) master.gain.setTargetAtTime(state.volume * 0.65, ctx.currentTime, 0.05);
    },
    getVolume: () => state.volume,
    /** 首次交互后再启动，避开浏览器的自动播放限制 */
    unlock() {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
    },
  };
}
