/**
 * 文字朗读器（基于浏览器 Web Speech API）。
 *
 * - 在设置面板里用一个空心方框开关控制是否启用；
 * - 启用后，在交互界面（展品介绍、抽签故事框等）按 L 键即可朗读当前界面里的文字；
 * - 正在朗读时再按一次 L 会停止。
 */
export function createReader() {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  let enabled = false;
  let voice = null;

  function pickVoice() {
    if (!supported) return;
    const voices = window.speechSynthesis.getVoices();
    voice =
      voices.find((item) => /^zh(-|_)?/i.test(item.lang)) ??
      voices.find((item) => /chinese|中文|普通话|國語|国语/i.test(item.name)) ??
      null;
  }

  if (supported) {
    pickVoice();
    window.speechSynthesis.addEventListener?.('voiceschanged', pickVoice);
  }

  /** 朗读一段文字，返回是否真的开始朗读 */
  function utter(text) {
    const content = String(text ?? '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\s*\n\s*/g, '。')
      .trim();
    if (!content) return false;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(content);
    utterance.lang = 'zh-CN';
    if (voice) utterance.voice = voice;
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
    return true;
  }

  /** 仅在朗读器开启时朗读 */
  function speak(text) {
    if (!supported || !enabled) return false;
    return utter(text);
  }

  /** 无论开关如何都朗读（供猜谜的语音导览 / 声音猜物使用） */
  function announce(text) {
    if (!supported) return false;
    return utter(text);
  }

  function stop() {
    if (supported) window.speechSynthesis.cancel();
  }

  return {
    supported,
    isEnabled: () => enabled,
    setEnabled(value) {
      enabled = Boolean(value);
      if (!enabled) stop();
      return enabled;
    },
    toggle() {
      enabled = !enabled;
      if (!enabled) stop();
      return enabled;
    },
    speak,
    announce,
    stop,
    isSpeaking: () => supported && window.speechSynthesis.speaking,
  };
}
