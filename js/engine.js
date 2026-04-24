// ─── Judgment Windows (seconds) ───────────────────────────────────────────────
export const JUDGMENTS = [
  { name: 'PERFECT', window: 0.045, score: 300, color: '#FFE566', glow: '#FFD700' },
  { name: 'GREAT',   window: 0.090, score: 200, color: '#66DDFF', glow: '#00BBFF' },
  { name: 'GOOD',    window: 0.135, score: 100, color: '#88FF99', glow: '#44FF66' },
  { name: 'BAD',     window: 0.200, score:  50, color: '#FF9955', glow: '#FF6600' },
  { name: 'MISS',    window: Infinity, score: 0, color: '#FF4455', glow: '#FF0000' },
];

// ─── HP Mode lookup table ──────────────────────────────────────────────────────
// Each mode defines HP_INIT and per-judgment deltas.
// "OneShot" is handled specially: any MISS triggers _triggerFail() directly.
const HP_MODES = {
  Generous: { HP_INIT: 80,  PERFECT: +2.5, GREAT: +1.5, GOOD: +0.5, BAD: -2.0,  MISS: -4.0  },
  Normal:   { HP_INIT: 70,  PERFECT: +1.5, GREAT: +1.0, GOOD: +0.2, BAD: -4.0,  MISS: -8.0  },
  Hard:     { HP_INIT: 60,  PERFECT: +1.0, GREAT: +0.5, GOOD:  0,   BAD: -6.0,  MISS: -12.0 },
  Cruel:    { HP_INIT: 50,  PERFECT: +0.5, GREAT: +0.2, GOOD:  0,   BAD: -10.0, MISS: -20.0 },
  OneShot:  { HP_INIT: 100, PERFECT: +0.5, GREAT: +0.2, GOOD:  0,   BAD: -10.0, MISS: -100  },
};
const HP_MAX  = 100;
const HP_FAIL = 0;

// ─── Visual Config (skinnable via CSS vars on canvas parent) ──────────────────
const SCROLL_SPEED = 700; // pixels per second notes travel
const HIT_LINE_Y_RATIO = 0.82; // hit zone position from top
const LOOKAHEAD_SECONDS = 2.0;
const NOTE_HEIGHT = 20;
const NOTE_RADIUS = 5;

/**
 * Note skin catalog. IDs must match SHOP_ITEMS in firebase.js.
 * Each skin defines the per-lane color palette used when rendering notes.
 * `glow` controls shadow blur intensity (px).
 */
export const NOTE_SKINS = {
  notes_neon: {
    name: 'Neon',
    colors: ['#FF4D6D', '#FFB347', '#4DC4FF', '#B47DFF'],
    dim:    ['#7A2333', '#7A5520', '#1A5A7A', '#4A2E7A'],
    glow: 12,
  },
  notes_fire: {
    name: 'Flame',
    colors: ['#FF3020', '#FF6B20', '#FFB040', '#FFE070'],
    dim:    ['#661008', '#662408', '#664010', '#665024'],
    glow: 18,
  },
  notes_matrix: {
    name: 'Matrix',
    colors: ['#00FF66', '#66FF88', '#99FFAA', '#33CC55'],
    dim:    ['#004422', '#226622', '#336644', '#114422'],
    glow: 14,
  },
  notes_gold: {
    name: 'Golden',
    colors: ['#FFE566', '#FFD700', '#FFB347', '#FFC830'],
    dim:    ['#665820', '#664E00', '#664010', '#665010'],
    glow: 20,
  },
  notes_ice: {
    name: 'Crystal',
    colors: ['#88DDFF', '#AAEEFF', '#4DC4FF', '#B0F0FF'],
    dim:    ['#224455', '#335566', '#1A5A7A', '#336677'],
    glow: 14,
  },
  notes_void: {
    name: 'Void',
    colors: ['#CC44FF', '#9922DD', '#EE88FF', '#7700BB'],
    dim:    ['#3A0050', '#280040', '#4A1060', '#1E0038'],
    glow: 22,
  },
  notes_blood: {
    name: 'Bloodbath',
    colors: ['#FF0022', '#CC0011', '#FF3344', '#880011'],
    dim:    ['#550008', '#440006', '#660010', '#330006'],
    glow: 16,
  },
  notes_candy: {
    name: 'Candy',
    colors: ['#FF77CC', '#FF99EE', '#FFBBAA', '#FF55BB'],
    dim:    ['#662244', '#663355', '#664444', '#661133'],
    glow: 12,
  },
  notes_mono: {
    name: 'Monochrome',
    colors: ['#FFFFFF', '#CCCCCC', '#AAAAAA', '#888888'],
    dim:    ['#333333', '#2A2A2A', '#222222', '#1A1A1A'],
    glow: 8,
  },
  notes_toxic: {
    name: 'Toxic',
    colors: ['#AAFF00', '#88DD00', '#CCFF44', '#66BB00'],
    dim:    ['#2A4400', '#223800', '#334400', '#1A3000'],
    glow: 18,
  },
};

// Mutable palette — the engine reads from these at every render, so skin
// swaps (via engine.setNoteSkin) take effect on the very next frame.
let LANE_COLORS = NOTE_SKINS.notes_neon.colors.slice();
let LANE_DIM    = NOTE_SKINS.notes_neon.dim.slice();
let NOTE_GLOW   = NOTE_SKINS.notes_neon.glow;

export class Engine {
  constructor(canvas, audioEngine, inputHandler) {
    this.canvas = canvas;
    this.ctx2d = canvas.getContext('2d');
    this.audio = audioEngine;
    this.input = inputHandler;

    this.chart = null;
    this.state = 'idle'; // idle | countdown | playing | paused | ended

    // Note speed multiplier (set before start(), must not change mid-map)
    this._noteSpeedMult = 1.0;
    // HP mode (set before start())
    this._hpMode = HP_MODES.Normal;
    this._hpModeIsOneShot = false;

    // Scoring
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
    this.accuracy = 100;
    this.totalHits = 0;
    this.totalWeightedAccuracy = 0;

    // HP / life
    this.hp = HP_MODES.Normal.HP_INIT;
    this.failOnZero = true;          // toggleable "practice mode"

    // Pause tracking
    this._pausedAt = 0;              // song-time position when paused

    // Visual fx
    this.hitEffects = [];   // { lane, judgment, startTime, alpha }
    this.laneFlash = [0, 0, 0, 0]; // flash intensity per lane
    this.lastJudgment = null;
    this.lastJudgmentTime = 0;
    this.comboPopTime = 0;

    // RAF handle
    this._rafId = null;
    this._boundLoop = this._loop.bind(this);

    // Resize
    this._resizeObs = new ResizeObserver(() => this._resize());
    this._resizeObs.observe(canvas.parentElement);
    this._resize();

    // Callbacks for UI
    this.onScore = null;
    this.onCombo = null;
    this.onJudgment = null;
    this.onEnd = null;
    this.onCountdown = null;
    this.onHp = null;           // (hp) → void, called on every HP change
    this.onFail = null;         // (results) → void, when HP hits 0

    // Input
    this._pressUnsub = this.input.on('press', e => this._onPress(e));
    this._releaseUnsub = this.input.on('release', e => this._onRelease(e));
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  loadChart(chart) {
    this.chart = chart;
    chart.reset();
    this._resetScore();
  }

  /** Set note speed multiplier. Must be called before start(). */
  setNoteSpeed(multiplier) {
    this._noteSpeedMult = multiplier ?? 1.0;
  }

  /** Set HP drain mode. Must be called before start(). Valid: Generous Normal Hard Cruel OneShot */
  setHpMode(mode) {
    this._hpMode = HP_MODES[mode] || HP_MODES.Normal;
    this._hpModeIsOneShot = (mode === 'OneShot');
  }

  /**
   * Swap the note skin at runtime. `id` must exist in NOTE_SKINS.
   * If `id` is unknown, falls back silently to 'notes_neon' so the game
   * never crashes on a stale/missing cosmetic reference.
   */
  setNoteSkin(id) {
    const skin = NOTE_SKINS[id] || NOTE_SKINS.notes_neon;
    LANE_COLORS = skin.colors.slice();
    LANE_DIM    = skin.dim.slice();
    NOTE_GLOW   = skin.glow;
  }

  async start() {
    if (!this.chart) return;
    this.state = 'countdown';
    await this._countdown();
    this.state = 'playing';
    this.audio.play(this.chart.offset);
    this._startLoop();
  }

  pause() {
    if (this.state !== 'playing') return;
    this._pausedAt = this.audio.getCurrentTime();
    this.state = 'paused';
    this.audio.stop();
    cancelAnimationFrame(this._rafId);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    // Restore from recorded position (not from chart.offset)
    this.audio.play(this._pausedAt);
    this._startLoop();
  }

  restart() {
    cancelAnimationFrame(this._rafId);
    this.audio.stop();
    if (this.chart) this.chart.reset();
    this._resetScore();
    this.hitEffects = [];
    this.laneFlash = [0, 0, 0, 0];
    this.lastJudgment = null;
    this.state = 'idle';
    this._render(0);
  }

  destroy() {
    cancelAnimationFrame(this._rafId);
    this._resizeObs.disconnect();
    this._pressUnsub();
    this._releaseUnsub();
  }

  getResults() {
    return {
      score: this.score,
      maxCombo: this.maxCombo,
      accuracy: this._calcAccuracy(),
      counts: { ...this.counts },
      totalNotes: this.chart?.totalNotes ?? 0,
      // True when the run ended because HP hit 0, not a completed clear.
      // submitScore() uses this so a fail doesn't mark first-clear or
      // write a leaderboard entry.
      failed: this.state === 'failed',
    };
  }

  // ─── Input Handling ──────────────────────────────────────────────────────────

  _onPress(e) {
    if (this.state !== 'playing') return;
    this.laneFlash[e.lane] = 1.0;
    this._judgePress(e.lane, e.time);
  }

  _onRelease(e) {
    this.laneFlash[e.lane] = 0;
  }

  _judgePress(lane, time) {
    const songTime = this.audio.getCurrentTime();
    // Find the earliest unhit note in this lane within max window
    const candidate = this.chart.notes.find(n =>
      n.lane === lane &&
      !n.hit &&
      !n.missed &&
      Math.abs(n.time - songTime) <= JUDGMENTS[JUDGMENTS.length - 2].window
    );

    if (!candidate) {
      // Ghost press - no note nearby, just flash
      return;
    }

    const delta = Math.abs(candidate.time - songTime);
    const judgment = JUDGMENTS.find(j => delta <= j.window);

    if (judgment.name === 'MISS') return; // shouldn't happen but guard

    candidate.hit = true;
    this._applyJudgment(judgment, lane);
  }

  _applyJudgment(judgment, lane) {
    this.score += judgment.score * Math.max(1, this.combo * 0.1 | 0);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[judgment.name]++;
    this.totalHits++;
    this.totalWeightedAccuracy += judgment.score / JUDGMENTS[0].score;

    // HP change
    this._changeHp(this._hpMode[judgment.name] || 0);

    this.lastJudgment = judgment;
    this.lastJudgmentTime = performance.now();
    this.comboPopTime = performance.now();

    this.hitEffects.push({
      lane,
      judgment,
      startTime: performance.now(),
      alpha: 1,
    });

    this.onScore?.(this.score);
    this.onCombo?.(this.combo, judgment);
    this.onJudgment?.(judgment);
  }

  _changeHp(delta) {
    this.hp = Math.max(0, Math.min(HP_MAX, this.hp + delta));
    this.onHp?.(this.hp);
    if (this.hp <= HP_FAIL && this.failOnZero && this.state === 'playing') {
      this._triggerFail();
    }
  }

  _triggerFail() {
    this.state = 'failed';
    this.audio.stop();
    cancelAnimationFrame(this._rafId);
    this._renderFailed();
    this.onFail?.(this.getResults());
  }

  _checkMisses(songTime) {
    const lateWindow = JUDGMENTS[JUDGMENTS.length - 2].window;
    this.chart.notes.forEach(n => {
      if (!n.hit && !n.missed && songTime - n.time > lateWindow) {
        n.missed = true;
        this.combo = 0;
        this.counts.MISS++;
        if (this._hpModeIsOneShot) {
          this._triggerFail();
          return;
        }
        this._changeHp(this._hpMode.MISS);
        this.lastJudgment = JUDGMENTS.find(j => j.name === 'MISS');
        this.lastJudgmentTime = performance.now();
        this.onCombo?.(0, this.lastJudgment);
        this.onJudgment?.(this.lastJudgment);
      }

    });
  }

  // ─── Countdown ───────────────────────────────────────────────────────────────

  _countdown() {
    return new Promise(resolve => {
      let count = 3;
      const tick = () => {
        this.onCountdown?.(count);
        this._renderCountdown(count);
        if (count <= 0) { resolve(); return; }
        count--;
        setTimeout(tick, 700);
      };
      tick();
    });
  }

  // ─── Main Loop ───────────────────────────────────────────────────────────────

  _startLoop() {
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  _loop(timestamp) {
    if (this.state !== 'playing') return;

    const songTime = this.audio.getCurrentTime();

    // Check misses
    this._checkMisses(songTime);

    // Fail may have been triggered by a miss this frame
    if (this.state !== 'playing') return;

    // Check song end
    if (songTime >= this.chart.durationSeconds + 1) {
      this.state = 'ended';
      this.audio.stop();
      this._renderEnd();
      this.onEnd?.(this.getResults());
      return;
    }

    this._render(songTime);
    this._rafId = requestAnimationFrame(this._boundLoop);
  }

  // ─── Rendering ───────────────────────────────────────────────────────────────

  _resize() {
    const parent = this.canvas.parentElement;
    const dpr = window.devicePixelRatio || 1;
    const w = parent.clientWidth;
    const h = parent.clientHeight;
    this.canvas.width = w * dpr;
    this.canvas.height = h * dpr;
    this.canvas.style.width = w + 'px';
    this.canvas.style.height = h + 'px';
    this.ctx2d.scale(dpr, dpr);
    this._w = w;
    this._h = h;
  }

  _render(songTime) {
    const c = this.ctx2d;
    const W = this._w, H = this._h;
    if (!W || !H) return;

    const hitY = H * HIT_LINE_Y_RATIO;
    const now = performance.now();

    // ── Background ──
    c.fillStyle = '#0a0a0f';
    c.fillRect(0, 0, W, H);

    // Scanlines (subtle, drawn once)
    c.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < H; y += 4) {
      c.fillRect(0, y, W, 2);
    }

    const laneW = W / 4;

    // ── Lane backgrounds ──
    for (let i = 0; i < 4; i++) {
      const x = i * laneW;
      const flash = this.laneFlash[i];
      const held = this.input.isHeld(i);

      // Lane bg with subtle color tint
      c.fillStyle = held
        ? `rgba(${this._hexToRgb(LANE_COLORS[i])}, 0.12)`
        : `rgba(${this._hexToRgb(LANE_COLORS[i])}, 0.04)`;
      c.fillRect(x, 0, laneW, H);

      // Lane dividers
      if (i > 0) {
        c.strokeStyle = 'rgba(255,255,255,0.06)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }

      // Decay flash
      if (this.laneFlash[i] > 0) {
        this.laneFlash[i] = Math.max(0, this.laneFlash[i] - 0.08);
      }
    }

    // ── Beat grid lines ──
    if (this.chart) {
      const runtimeSpeed = SCROLL_SPEED * this._noteSpeedMult;
      const secPerBeat = 60 / this.chart.bpm;
      const firstVisibleBeat = Math.floor(songTime / secPerBeat);
      for (let b = firstVisibleBeat; b < firstVisibleBeat + Math.ceil(LOOKAHEAD_SECONDS / secPerBeat) + 2; b++) {
        const beatTime = b * secPerBeat;
        const yOff = (beatTime - songTime) * runtimeSpeed;
        const y = hitY - yOff;
        if (y < 0 || y > H) continue;
        const isMeasure = b % 4 === 0;
        c.strokeStyle = isMeasure ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)';
        c.lineWidth = isMeasure ? 1.5 : 0.5;
        c.beginPath();
        c.moveTo(0, y);
        c.lineTo(W, y);
        c.stroke();
      }
    }

    // ── Hit line ──
    // Glow effect for hit zone
    const glowGrad = c.createLinearGradient(0, hitY - 8, 0, hitY + 8);
    glowGrad.addColorStop(0, 'transparent');
    glowGrad.addColorStop(0.5, 'rgba(255,255,255,0.15)');
    glowGrad.addColorStop(1, 'transparent');
    c.fillStyle = glowGrad;
    c.fillRect(0, hitY - 8, W, 16);

    c.strokeStyle = 'rgba(255,255,255,0.5)';
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(0, hitY);
    c.lineTo(W, hitY);
    c.stroke();

    // ── Hit zone receivers ──
    for (let i = 0; i < 4; i++) {
      const x = i * laneW;
      const cx = x + laneW / 2;
      const held = this.input.isHeld(i);
      const color = LANE_COLORS[i];

      // Receiver circle
      c.beginPath();
      c.arc(cx, hitY, 18, 0, Math.PI * 2);
      c.fillStyle = held ? color : 'rgba(255,255,255,0.08)';
      c.fill();
      c.strokeStyle = held ? color : LANE_DIM[i];
      c.lineWidth = 2;
      c.stroke();

      // Inner dot
      c.beginPath();
      c.arc(cx, hitY, 5, 0, Math.PI * 2);
      c.fillStyle = held ? '#fff' : 'rgba(255,255,255,0.3)';
      c.fill();

      // Key hint label
      const keys = ['D', 'F', 'J', 'K'];
      c.fillStyle = held ? '#fff' : 'rgba(255,255,255,0.25)';
      c.font = `bold 10px 'Courier New', monospace`;
      c.textAlign = 'center';
      c.fillText(keys[i], cx, hitY + 36);
    }

    // ── Notes ──
    if (this.chart) {
      const visibleNotes = this.chart.getNotesInWindow(songTime, LOOKAHEAD_SECONDS);
      visibleNotes.forEach(note => this._drawNote(c, note, songTime, hitY, laneW, W));
    }

    // ── Hit effects ──
    this.hitEffects = this.hitEffects.filter(fx => {
      const age = now - fx.startTime;
      if (age > 400) return false;
      const t = age / 400;
      this._drawHitEffect(c, fx, t, hitY, laneW);
      return true;
    });

    // ── Judgment text ──
    if (this.lastJudgment) {
      const age = now - this.lastJudgmentTime;
      if (age < 600) {
        const t = age / 600;
        const alpha = t < 0.5 ? 1 : 1 - (t - 0.5) * 2;
        const y = hitY - 60 - (t * 30);
        c.save();
        c.globalAlpha = alpha;
        c.font = `bold 22px 'Courier New', monospace`;
        c.textAlign = 'center';
        c.fillStyle = this.lastJudgment.color;
        c.shadowColor = this.lastJudgment.glow;
        c.shadowBlur = 12;
        c.fillText(this.lastJudgment.name, W / 2, y);
        c.restore();
      }
    }

    // ── Combo ──
    if (this.combo > 1) {
      const popAge = now - this.comboPopTime;
      const popT = Math.min(1, popAge / 150);
      const scale = 1 + (1 - popT) * 0.4;
      c.save();
      c.translate(W / 2, hitY - 95);
      c.scale(scale, scale);
      c.font = `bold 32px 'Courier New', monospace`;
      c.textAlign = 'center';
      c.fillStyle = '#ffffff';
      c.globalAlpha = 0.9;
      c.fillText(this.combo, 0, 0);
      c.font = `11px 'Courier New', monospace`;
      c.fillStyle = 'rgba(255,255,255,0.5)';
      c.fillText('COMBO', 0, 16);
      c.restore();
    }
  }

  _drawNote(c, note, songTime, hitY, laneW, W) {
    const timeOffset = note.time - songTime;
    const runtimeSpeed = SCROLL_SPEED * this._noteSpeedMult;
    const y = hitY - (timeOffset * runtimeSpeed);
    const x = note.lane * laneW;
    const cx = x + laneW / 2;
    const noteW = laneW * 0.55;
    const color = LANE_COLORS[note.lane];

    // Don't draw if below hit line (missed/just hit) or above viewport
    if (y > hitY + 40) return;

    // ── Note head ──
    if (!note.hit) {
      const noteY = note.hit ? hitY : y;
      if (noteY < -NOTE_HEIGHT || noteY > hitY + 10) return;

      // Glow
      c.shadowColor = color;
      c.shadowBlur = NOTE_GLOW;

      // Note body
      c.fillStyle = color;
      c.beginPath();
      this._roundedRect(c, cx - noteW / 2, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT, NOTE_RADIUS);
      c.fill();

      // Specular highlight
      c.fillStyle = 'rgba(255,255,255,0.35)';
      c.beginPath();
      this._roundedRect(c, cx - noteW / 2 + 3, noteY - NOTE_HEIGHT / 2 + 3, noteW - 6, NOTE_HEIGHT / 3, 2);
      c.fill();

      c.shadowBlur = 0;
    }
  }

  _drawHitEffect(c, fx, t, hitY, laneW) {
    const cx = fx.lane * laneW + laneW / 2;
    const alpha = 1 - t;
    const radius = 20 + t * 50;
    const color = fx.judgment.color;

    c.save();
    c.globalAlpha = alpha * 0.6;
    c.strokeStyle = color;
    c.lineWidth = 3 - t * 2;
    c.beginPath();
    c.arc(cx, hitY, radius, 0, Math.PI * 2);
    c.stroke();

    // Particles
    const particleCount = 6;
    for (let i = 0; i < particleCount; i++) {
      const angle = (i / particleCount) * Math.PI * 2;
      const dist = t * 55;
      const px = cx + Math.cos(angle) * dist;
      const py = hitY + Math.sin(angle) * dist;
      c.beginPath();
      c.arc(px, py, 3 * (1 - t), 0, Math.PI * 2);
      c.fillStyle = color;
      c.fill();
    }
    c.restore();
  }

  _renderCountdown(count) {
    const c = this.ctx2d;
    const W = this._w, H = this._h;
    c.fillStyle = '#0a0a0f';
    c.fillRect(0, 0, W, H);

    c.fillStyle = 'rgba(255,255,255,0.08)';
    for (let y = 0; y < H; y += 4) {
      c.fillRect(0, y, W, 2);
    }

    c.font = `bold 80px 'Courier New', monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = count > 0 ? '#ffffff' : LANE_COLORS[0];
    c.shadowColor = count > 0 ? '#ffffff' : LANE_COLORS[0];
    c.shadowBlur = 30;
    c.fillText(count > 0 ? count : 'GO!', W / 2, H / 2);
    c.shadowBlur = 0;
    c.textBaseline = 'alphabetic';
  }

  _renderEnd() {
    const c = this.ctx2d;
    const W = this._w, H = this._h;
    c.fillStyle = 'rgba(10,10,15,0.85)';
    c.fillRect(0, 0, W, H);
    c.font = `bold 40px 'Courier New', monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#FFE566';
    c.shadowColor = '#FFD700';
    c.shadowBlur = 20;
    c.fillText('STAGE CLEAR', W / 2, H / 2);
    c.shadowBlur = 0;
    c.textBaseline = 'alphabetic';
  }

  _renderFailed() {
    const c = this.ctx2d;
    const W = this._w, H = this._h;
    c.fillStyle = 'rgba(20,0,5,0.9)';
    c.fillRect(0, 0, W, H);
    c.font = `bold 42px 'Courier New', monospace`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = '#FF4455';
    c.shadowColor = '#FF0000';
    c.shadowBlur = 25;
    c.fillText('FAILED', W / 2, H / 2);
    c.shadowBlur = 0;
    c.textBaseline = 'alphabetic';
  }

  // ─── Utils ───────────────────────────────────────────────────────────────────

  _resetScore() {
    this.score = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.counts = { PERFECT: 0, GREAT: 0, GOOD: 0, BAD: 0, MISS: 0 };
    this.totalHits = 0;
    this.totalWeightedAccuracy = 0;
    this.lastJudgment = null;
    this.hitEffects = [];
    this.laneFlash = [0, 0, 0, 0];
    this.hp = this._hpMode.HP_INIT;
    this._pausedAt = 0;
    this.onHp?.(this.hp);
    this.onScore?.(0);
    this.onCombo?.(0, null);
  }

  _calcAccuracy() {
    if (this.totalHits === 0) return 100;
    return (this.totalWeightedAccuracy / (this.chart?.totalNotes ?? 1)) * 100;
  }

  _roundedRect(ctx, x, y, w, h, r) {
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  _hexToRgb(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `${r},${g},${b}`;
  }
}