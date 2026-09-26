/**
 * 背景音乐：不用任何音频素材，全部 WebAudio 现场合成。
 *
 * 五首曲目 —— 温柔 / 激进 / 缓和乐观 / 摇滚 / 轻音乐。
 * 每首就是一组参数（根音、音阶、波形、BPM、衰减、滤波、音符疏密、
 * 铺底、混响、鼓组），差异全部落在参数上，改 TRACKS 就是改风格。
 *
 * 一首放满 PLAN_NOTES 个音符算一遍，放完按模式决定下一遍：
 *   循环模式（默认）—— 同一首再来一遍
 *   随机模式        —— 换一首，且不会连续重复同一首
 *
 * 设置面板里的勾选项由本模块自己接线（bindLoopToggle），main.js 不用管。
 */
export function createAudio() {
  const state = { volume: 0.45, playing: false, loop: true, track: 0 };
  const PLAN_NOTES = 26; // 一首的长度：26 个音符算一遍

  let ctx = null;
  let master = null;
  let wet = null;
  let noise = null;
  let pad = null;
  let timer = null;
  let nextNoteAt = 0;
  let nextBeatAt = 0;
  let notesLeft = 0;

  /** 曲目参数表的构造器，省掉一大片重复的键名 */
  const T = (id, name, root, scale, osc, bpm, decay, cutoff, q, gap, level, padLevel, ratios, padTypes, reverb, drums) => ({
    id, name, root, scale, osc, bpm, decay, cutoff, q, gap, level, padLevel, ratios, padTypes, reverb, drums,
  });

  const TRACKS = [
    // 温柔：慢、大调五声、纯正弦、长衰减、混响重、无鼓
    T('gentle', '温柔', 196.0, [0, 2, 4, 7, 9, 12, 14, 16], 'sine', 58, 3.6, 1400, 0.5,
      [1.1, 2.8], [0.06, 0.12], 0.5, [0.25, 0.375, 0.75], ['sine', 'sine', 'triangle'], 0.55, null),
    // 激进：快、含小二度、锯齿波、短衰减、高 Q 滤波、全套鼓
    T('aggressive', '激进', 146.83, [0, 1, 5, 6, 8, 11, 12], 'sawtooth', 152, 0.85, 3400, 3.2,
      [0.14, 0.4], [0.09, 0.17], 0.32, [0.5, 0.75, 1.5], ['sawtooth', 'square', 'sawtooth'], 0.22,
      { kick: 0.5, snare: 0.25, hat: 0.125 }),
    // 缓和乐观：中速、大调七声、三角波、只有底鼓与踩镲
    T('hopeful', '缓和乐观', 220.0, [0, 2, 4, 5, 7, 9, 11, 12, 16], 'triangle', 96, 1.8, 2600, 0.8,
      [0.42, 1.1], [0.08, 0.15], 0.45, [0.25, 0.5, 0.75], ['triangle', 'sine', 'sine'], 0.42,
      { kick: 0.5, snare: 0, hat: 0.25 }),
    // 摇滚：小调五声、方波、极短衰减、双踩
    T('rock', '摇滚', 130.81, [0, 3, 5, 6, 7, 10, 12], 'square', 128, 0.55, 4200, 5.0,
      [0.18, 0.34], [0.1, 0.2], 0.28, [0.5, 0.5, 1], ['square', 'sawtooth', 'square'], 0.2,
      { kick: 0.5, snare: 0.5, hat: 0.25, double: true }),
    // 轻音乐：高音区、九声音阶、极短促的疏密、混响最重、无鼓
    T('light', '轻音乐', 261.63, [0, 2, 4, 7, 9, 11, 12, 14, 16, 19], 'sine', 84, 2.6, 5200, 0.4,
      [0.3, 0.9], [0.05, 0.11], 0.4, [0.5, 0.75, 1.5], ['sine', 'sine', 'sine'], 0.6, null),
  ];

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

    // 鼓用的白噪声
    noise = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.5), ctx.sampleRate);
    const nd = noise.getChannelData(0);
    for (let i = 0; i < nd.length; i += 1) nd[i] = Math.random() * 2 - 1;
  }

  function pluck(track, frequency, time, level) {
    const osc = ctx.createOscillator();
    osc.type = track.osc;
    osc.frequency.value = frequency;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, time);
    gain.gain.exponentialRampToValueAtTime(level, time + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + track.decay);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = track.cutoff;
    filter.Q.value = track.q;

    osc.connect(gain);
    gain.connect(filter);
    filter.connect(master);
    filter.connect(wet);
    osc.start(time);
    osc.stop(time + track.decay + 0.2);
  }

  /** 鼓：kick 是频率骤降的正弦，snare 是带通噪声，hat 是高通噪声 */
  function hit(kind, time, level) {
    if (kind === 'kick') {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(118, time);
      osc.frequency.exponentialRampToValueAtTime(42, time + 0.11);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(level, time);
      gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.3);
      osc.connect(gain);
      gain.connect(master);
      osc.start(time);
      osc.stop(time + 0.34);
      return;
    }
    const src = ctx.createBufferSource();
    src.buffer = noise;
    const filter = ctx.createBiquadFilter();
    if (kind === 'snare') {
      filter.type = 'bandpass';
      filter.frequency.value = 1800;
      filter.Q.value = 0.8;
    } else {
      filter.type = 'highpass';
      filter.frequency.value = 8800;
    }
    const gain = ctx.createGain();
    const dur = kind === 'snare' ? 0.15 : 0.035;
    gain.gain.setValueAtTime(level, time);
    gain.gain.exponentialRampToValueAtTime(0.0001, time + dur);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    gain.connect(wet);
    src.start(time);
    src.stop(time + dur + 0.05);
  }

  /** 铺底：每首自己的音色与音量；换曲时旧的淡出、新的淡入 */
  // 铺底的低通截止。裸的锯齿/方波在低音区谐波极密，听感就是一片滋滋的底噪，
  // 激进的 sawtooth 与摇滚的 square 尤其刺耳，所以这两首压得最低。
  const PAD_CUTOFF = { gentle: 900, aggressive: 620, hopeful: 1000, rock: 520, light: 1400 };

  function makePad(track) {
    const gain = ctx.createGain();
    gain.gain.value = 0;
    gain.connect(master);
    gain.connect(wet);
    const nodes = [];
    track.ratios.forEach((ratio, index) => {
      const osc = ctx.createOscillator();
      osc.type = track.padTypes[index] ?? 'sine';
      osc.frequency.value = track.root * ratio;
      const voice = ctx.createGain();
      voice.gain.value = 0.09;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 0.04 + index * 0.021;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.022;   // 原来 0.04，颤音太深会发嗡
      lfo.connect(lfoGain);
      lfoGain.connect(voice.gain);
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = PAD_CUTOFF[track.id] ?? 900;
      lp.Q.value = 0.7;
      osc.connect(lp);
      lp.connect(voice);
      voice.connect(gain);
      osc.start();
      lfo.start();
      nodes.push({ osc, lfo });
    });
    gain.gain.setTargetAtTime(track.padLevel, ctx.currentTime, 1.2);
    return { gain, nodes };
  }

  function dropPad(instance) {
    if (!instance) return;
    instance.gain.gain.cancelScheduledValues(ctx.currentTime);
    instance.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(() => {
      for (const { osc, lfo } of instance.nodes) {
        try {
          osc.stop();
          lfo.stop();
        } catch {
          /* 已经停了 */
        }
      }
    }, 2000);
  }

  function pickOther() {
    if (TRACKS.length < 2) return state.track;
    let next = state.track;
    while (next === state.track) next = Math.floor(Math.random() * TRACKS.length);
    return next;
  }

  /** 切到第 index 首，第一遍从 at 这个时刻开始排 */
  function startTrack(index, at) {
    state.track = index;
    const track = TRACKS[index];
    wet.gain.setTargetAtTime(track.reverb, ctx.currentTime, 0.6);
    dropPad(pad);
    pad = makePad(track);
    notesLeft = PLAN_NOTES;
    nextNoteAt = at;
    nextBeatAt = at;
  }

  function schedule() {
    if (!state.playing || !ctx) return;
    const track = TRACKS[state.track];
    const ahead = ctx.currentTime + 1.2;

    // 鼓走自己的节拍网格（八分音符，每两格一循环）
    if (track.drums) {
      const step = 60 / track.bpm / 2;
      while (nextBeatAt < ahead) {
        const d = track.drums;
        if (d.kick) hit('kick', nextBeatAt, 0.5);
        if (d.snare) hit('snare', nextBeatAt + step, 0.2);
        if (d.hat) hit('hat', nextBeatAt, 0.055);
        if (d.double) hit('kick', nextBeatAt + step * 0.75, 0.34);
        nextBeatAt += step * 2;
      }
    }

    while (notesLeft > 0 && nextNoteAt < ahead) {
      const degree = track.scale[Math.floor(Math.random() * track.scale.length)];
      const octave = Math.random() < 0.22 ? 0.5 : 1;
      const level = track.level[0] + Math.random() * (track.level[1] - track.level[0]);
      pluck(track, track.root * octave * 2 ** (degree / 12), Math.max(nextNoteAt, ctx.currentTime + 0.05), level);
      notesLeft -= 1;
      nextNoteAt += track.gap[0] + Math.random() * (track.gap[1] - track.gap[0]);
    }

    // 一遍放完：循环就同一首再来，随机就换一首（不重复当前）
    if (notesLeft <= 0) {
      startTrack(state.loop ? state.track : pickOther(), nextNoteAt + 2.2);
    }
  }

  function start() {
    ensure();
    if (ctx.state === 'suspended') ctx.resume();
    if (state.playing) return;
    state.playing = true;
    startTrack(state.track, ctx.currentTime + 0.3);
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
    dropPad(pad);
    pad = null;
  }

  const api = {
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
    /** 勾选 = 循环当前这首；取消 = 每遍随机换一首 */
    setLoop(value) {
      state.loop = Boolean(value);
      return state.loop;
    },
    isLooping: () => state.loop,
    /** 当前曲目：{ index, id, name, ... } */
    currentTrack: () => ({ index: state.track, ...TRACKS[state.track] }),
    tracks: () => TRACKS.map((track) => ({ id: track.id, name: track.name })),
    /** 立刻换一首（调试用） */
    nextTrack() {
      if (state.playing && ctx) startTrack(pickOther(), ctx.currentTime + 0.3);
      else state.track = pickOther();
      return api.currentTrack();
    },
    /** 把设置面板里的勾选项接上。沿用项目里 .check-toggle + aria-checked 的写法 */
    bindLoopToggle() {
      const button = document.getElementById('music-loop');
      if (!button) return;
      const label = document.getElementById('music-loop-state');
      const apply = () => {
        button.classList.toggle('on', state.loop);
        button.setAttribute('aria-checked', String(state.loop));
        if (label) label.textContent = state.loop ? '循环当前曲目' : '随机播放';
      };
      apply();
      button.addEventListener('click', () => {
        state.loop = !state.loop;
        apply();
      });
    },
    /** 首次交互后再启动，避开浏览器的自动播放限制 */
    unlock() {
      ensure();
      if (ctx.state === 'suspended') ctx.resume();
    },
  };

  api.bindLoopToggle();
  return api;
}
