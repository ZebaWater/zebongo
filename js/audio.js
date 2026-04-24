export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.source = null;
    this.buffer = null;
    this.startTime = 0;       // AudioContext time when song started
    this.startOffset = 0;     // Song offset in seconds (user calibration)
    this.isPlaying = false;
    this.onEnd = null;
  }

  async init() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Resume on user gesture (browser autoplay policy)
    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }
  }

  async loadFromUrl(url) {
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    this.buffer = await this.ctx.decodeAudioData(arrayBuffer);
  }

  loadSilent(durationSeconds) {
    // Create a silent buffer for testing without audio
    const sr = this.ctx.sampleRate;
    this.buffer = this.ctx.createBuffer(1, Math.ceil(durationSeconds * sr), sr);
  }

  play(offsetSeconds = 0) {
    if (!this.ctx || !this.buffer) return;
    this.stop();

    this.source = this.ctx.createBufferSource();
    this.source.buffer = this.buffer;
    this.source.connect(this.ctx.destination);

    this.startOffset = offsetSeconds;
    this.startTime = this.ctx.currentTime;
    this.source.start(0, offsetSeconds < 0 ? 0 : offsetSeconds);
    this.isPlaying = true;

    this.source.onended = () => {
      this.isPlaying = false;
      this.onEnd?.();
    };
  }

  stop() {
    if (this.source) {
      // Detach the natural-end handler BEFORE stopping. Calling source.stop()
      // also triggers onended, so without this line our own stop() call would
      // spuriously fire `onEnd`, making consumers (e.g. the engine subscribing
      // to detect the real end-of-song) think the song just ended naturally
      // every time we pause/retry.
      this.source.onended = null;
      try { this.source.stop(); } catch (_) {}
      this.source.disconnect();
      this.source = null;
    }
    this.isPlaying = false;
  }

  /**
   * Returns precise song position in seconds.
   * This is the single source of truth for all game timing.
   *
   * IMPORTANT: We deliberately do NOT gate this on `isPlaying`. When the
   * audio buffer runs out, `isPlaying` flips to false but the AudioContext
   * clock keeps ticking — the engine needs a monotonically-increasing
   * song time for its end-of-song check to eventually fire. Gating on
   * isPlaying caused the game to freeze when a chart's duration reached
   * the end of its audio file: once the MP3 stopped, this method returned
   * 0 forever and the engine waited for an end condition that never came.
   */
  getCurrentTime() {
    if (!this.ctx) return 0;
    if (this.startTime === 0) return 0;   // play() was never called
    return (this.ctx.currentTime - this.startTime) + this.startOffset;
  }

  getContextTime() {
    return this.ctx?.currentTime ?? 0;
  }

  destroy() {
    this.stop();
    this.ctx?.close();
  }
}