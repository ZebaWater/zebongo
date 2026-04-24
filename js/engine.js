// ─── Judgment Windows (seconds) ───────────────────────────────────────────────
export const JUDGMENTS = [
  { name: 'PERFECT', window: 0.045, score: 300, color: '#FFE566', glow: '#FFD700' },
  { name: 'GREAT',   window: 0.090, score: 200, color: '#66DDFF', glow: '#00BBFF' },
  { name: 'GOOD',    window: 0.135, score: 100, color: '#88FF99', glow: '#44FF66' },
  { name: 'BAD',     window: 0.200, score:  50, color: '#FF9955', glow: '#FF6600' },
  { name: 'MISS',    window: Infinity, score: 0, color: '#FF4455', glow: '#FF0000' },
];

// ─── HP Mode lookup table ──────────────────────────────────────────────────────
const HP_MODES = {
  Generous: { HP_INIT: 80,  PERFECT: +2.5, GREAT: +1.5, GOOD: +0.5, BAD: -2.0,  MISS: -4.0  },
  Normal:   { HP_INIT: 70,  PERFECT: +1.5, GREAT: +1.0, GOOD: +0.2, BAD: -4.0,  MISS: -8.0  },
  Hard:     { HP_INIT: 60,  PERFECT: +1.0, GREAT: +0.5, GOOD:  0,   BAD: -6.0,  MISS: -12.0 },
  Cruel:    { HP_INIT: 50,  PERFECT: +0.5, GREAT: +0.2, GOOD:  0,   BAD: -10.0, MISS: -20.0 },
  OneShot:  { HP_INIT: 100, PERFECT: +0.5, GREAT: +0.2, GOOD:  0,   BAD: -10.0, MISS: -100  },
};
const HP_MAX  = 100;
const HP_FAIL = 0;

// ─── Visual Config ────────────────────────────────────────────────────────────
const SCROLL_SPEED = 700; // pixels per second notes travel
const HIT_LINE_Y_RATIO = 0.82;
const LOOKAHEAD_SECONDS = 2.0;
const NOTE_HEIGHT = 20;
const NOTE_RADIUS = 5;

// Hold note tail release judgment windows (seconds from tailTime).
// Release timing is more lenient than head timing:
//   early release before tailTime → BAD only (no combo break)
//   late release after tailTime   → graded normally
//   tail window expires without release → tailMissed (BAD, no combo break)
const HOLD_TAIL_WINDOWS = [
  { name: 'PERFECT', window: 0.060 },
  { name: 'GREAT',   window: 0.120 },
  { name: 'GOOD',    window: 0.180 },
  { name: 'BAD',     window: 0.260 },
];
// After this many seconds past tailTime with no release → auto-resolve as BAD
const HOLD_TAIL_EXPIRE = 0.300;

/**
 * Note skin catalog.
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
    this.state = 'idle';

    this._noteSpeedMult = 1.0;
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

    // HP
    this.hp = HP_MODES.Normal.HP_INIT;
    this.failOnZero = true;

    // Pause tracking
    this._pausedAt = 0;

    // Visual fx
    this.hitEffects = [];
    this.laneFlash = [0, 0, 0, 0];
    this.lastJudgment = null;
    this.lastJudgmentTime = 0;
    this.comboPopTime = 0;

    // RAF
    this._rafId = null;
    this._boundLoop = this._loop.bind(this);

    // Resize
    this._resizeObs = new ResizeObserver(() => this._resize());
    this._resizeObs.observe(canvas.parentElement);
    this._resize();

    // Callbacks
    this.onScore = null;
    this.onCombo = null;
    this.onJudgment = null;
    this.onEnd = null;
    this.onCountdown = null;
    this.onHp = null;
    this.onFail = null;

    // Input
    this._pressUnsub   = this.input.on('press',   e => this._onPress(e));
    this._releaseUnsub = this.input.on('release',  e => this._onRelease(e));

    // Hold tracking: lane → note being held (or null)
    // Keyed by lane index so only one hold per lane at a time.
    this._heldHolds = [null, null, null, null];
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  loadChart(chart) {
    this.chart = chart;
    chart.reset();
    this._resetScore();
  }

  setNoteSpeed(multiplier) {
    this._noteSpeedMult = multiplier ?? 1.0;
  }

  setHpMode(mode) {
    this._hpMode = HP_MODES[mode] || HP_MODES.Normal;
    this._hpModeIsOneShot = (mode === 'OneShot');
  }

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
    // Auto-resolve any active holds on pause
    this._heldHolds = [null, null, null, null];
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
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
    this._heldHolds = [null, null, null, null];
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
    if (this.state !== 'playing') return;
    this._judgeRelease(e.lane);
  }

  _judgePress(lane, time) {
    const songTime = this.audio.getCurrentTime();
    const candidate = this.chart.notes.find(n =>
      n.lane === lane &&
      !n.hit &&
      !n.missed &&
      Math.abs(n.time - songTime) <= JUDGMENTS[JUDGMENTS.length - 2].window
    );

    if (!candidate) return;

    const delta = Math.abs(candidate.time - songTime);
    const judgment = JUDGMENTS.find(j => delta <= j.window);
    if (judgment.name === 'MISS') return;

    candidate.hit = true;

    if (candidate.isHold) {
      // Register this as the active hold on this lane
      this._heldHolds[lane] = candidate;
      // Head press judgment — score & combo as normal
      this._applyJudgment(judgment, lane);
    } else {
      this._applyJudgment(judgment, lane);
    }
  }

  _judgeRelease(lane) {
    const note = this._heldHolds[lane];
    if (!note) return;
    if (!note.isHold || note.tailHit || note.tailMissed) {
      this._heldHolds[lane] = null;
      return;
    }

    const songTime = this.audio.getCurrentTime();
    const delta = songTime - note.tailTime; // negative = early, positive = late

    // Determine tail judgment by absolute timing distance from tailTime
    const absDelta = Math.abs(delta);
    let tailJudgment;
    for (const tw of HOLD_TAIL_WINDOWS) {
      if (absDelta <= tw.window) {
        tailJudgment = JUDGMENTS.find(j => j.name === tw.name);
        break;
      }
    }
    if (!tailJudgment) tailJudgment = JUDGMENTS.find(j => j.name === 'BAD');

    // Early release (before tailTime): clamp to BAD regardless of window
    if (delta < 0) {
      tailJudgment = JUDGMENTS.find(j => j.name === 'BAD');
    }

    note.tailHit = true;
    this._heldHolds[lane] = null;

    // Tail judgment: scores and HP but NEVER breaks combo
    this._applyTailJudgment(tailJudgment, lane);
  }

  /**
   * Apply a hold tail judgment.
   * Tail judgements score points and affect HP, but a BAD tail does NOT
   * break combo. Only a full MISS (unstarted head) breaks combo.
   */
  _applyTailJudgment(judgment, lane) {
    // Score with current combo multiplier (same formula as heads)
    this.score += judgment.score * Math.max(1, this.combo * 0.1 | 0);

    // Only advance combo if the tail wasn't the worst possible
    // (BAD tail = no combo increment, but also no combo break)
    if (judgment.name !== 'BAD') {
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
    }

    this.counts[judgment.name]++;
    this.totalHits++;
    this.totalWeightedAccuracy += judgment.score / JUDGMENTS[0].score;

    this._changeHp(this._hpMode[judgment.name] || 0);

    this.lastJudgment = judgment;
    this.lastJudgmentTime = performance.now();
    if (judgment.name !== 'BAD') this.comboPopTime = performance.now();

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

  _applyJudgment(judgment, lane) {
    this.score += judgment.score * Math.max(1, this.combo * 0.1 | 0);
    this.combo++;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    this.counts[judgment.name]++;
    this.totalHits++;
    this.totalWeightedAccuracy += judgment.score / JUDGMENTS[0].score;

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
      // ── Head miss ──
      if (!n.hit && !n.missed && songTime - n.time > lateWindow) {
        n.missed = true;
        // If hold, also immediately mark tail as missed — player can't
        // start a hold from the middle after the head was missed.
        if (n.isHold) {
          n.tailMissed = true;
          // Clear any phantom hold reference
          if (this._heldHolds[n.lane] === n) this._heldHolds[n.lane] = null;
        }
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

      // ── Hold tail expiry (player never released in time) ──
      if (
        n.isHold &&
        n.hit &&
        !n.tailHit &&
        !n.tailMissed &&
        songTime - n.tailTime > HOLD_TAIL_EXPIRE
      ) {
        n.tailMissed = true;
        if (this._heldHolds[n.lane] === n) this._heldHolds[n.lane] = null;
        // BAD tail — no combo break
        const badJudgment = JUDGMENTS.find(j => j.name === 'BAD');
        this._applyTailJudgment(badJudgment, n.lane);
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

    this._checkMisses(songTime);

    if (this.state !== 'playing') return;

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

    c.fillStyle = 'rgba(0,0,0,0.07)';
    for (let y = 0; y < H; y += 4) {
      c.fillRect(0, y, W, 2);
    }

    const laneW = W / 4;

    // ── Lane backgrounds ──
    for (let i = 0; i < 4; i++) {
      const x = i * laneW;
      const held = this.input.isHeld(i);

      c.fillStyle = held
        ? `rgba(${this._hexToRgb(LANE_COLORS[i])}, 0.12)`
        : `rgba(${this._hexToRgb(LANE_COLORS[i])}, 0.04)`;
      c.fillRect(x, 0, laneW, H);

      if (i > 0) {
        c.strokeStyle = 'rgba(255,255,255,0.06)';
        c.lineWidth = 1;
        c.beginPath();
        c.moveTo(x, 0);
        c.lineTo(x, H);
        c.stroke();
      }

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

      // Pulse the receiver if this lane has an active hold in progress
      const hasActiveHold = this._heldHolds[i] !== null;

      c.beginPath();
      c.arc(cx, hitY, hasActiveHold ? 22 : 18, 0, Math.PI * 2);
      c.fillStyle = held ? color : 'rgba(255,255,255,0.08)';
      c.fill();
      c.strokeStyle = hasActiveHold ? color : (held ? color : LANE_DIM[i]);
      c.lineWidth = hasActiveHold ? 3 : 2;
      if (hasActiveHold) {
        c.shadowColor = color;
        c.shadowBlur = 12;
      }
      c.stroke();
      c.shadowBlur = 0;

      c.beginPath();
      c.arc(cx, hitY, 5, 0, Math.PI * 2);
      c.fillStyle = held ? '#fff' : 'rgba(255,255,255,0.3)';
      c.fill();

      const keys = ['D', 'F', 'J', 'K'];
      c.fillStyle = held ? '#fff' : 'rgba(255,255,255,0.25)';
      c.font = `bold 10px 'Courier New', monospace`;
      c.textAlign = 'center';
      c.fillText(keys[i], cx, hitY + 36);
    }

    // ── Notes ──
    if (this.chart) {
      const runtimeSpeed = SCROLL_SPEED * this._noteSpeedMult;
      const visibleNotes = this.chart.getNotesInWindow(songTime, LOOKAHEAD_SECONDS);
      // Draw hold bodies first (behind tap notes / heads)
      visibleNotes.forEach(note => {
        if (note.isHold) this._drawHoldBody(c, note, songTime, hitY, laneW, runtimeSpeed);
      });
      // Then draw all note heads on top
      visibleNotes.forEach(note => this._drawNote(c, note, songTime, hitY, laneW, runtimeSpeed));
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

  /**
   * Draw the hold body (the connector bar between head and tail).
   * Drawn before heads so heads always render on top.
   */
  _drawHoldBody(c, note, songTime, hitY, laneW, runtimeSpeed) {
    const color = LANE_COLORS[note.lane];
    const x = note.lane * laneW;
    const cx = x + laneW / 2;
    const noteW = laneW * 0.55;
    const bodyW = noteW * 0.45; // narrower than head

    // Head Y position — clamp to hitY if already hit (being held)
    const headY = note.hit
      ? hitY
      : hitY - (note.time - songTime) * runtimeSpeed;

    // Tail Y
    const tailY = hitY - (note.tailTime - songTime) * runtimeSpeed;

    if (tailY > hitY + 10) return; // tail is below the hit line, nothing to draw

    const topY    = Math.max(tailY, -NOTE_HEIGHT);
    const bottomY = Math.min(headY, hitY);
    const barH    = bottomY - topY;
    if (barH <= 0) return;

    // Body gradient (slightly transparent)
    const grad = c.createLinearGradient(cx, topY, cx, bottomY);
    grad.addColorStop(0, `rgba(${this._hexToRgb(color)}, 0.35)`);
    grad.addColorStop(1, `rgba(${this._hexToRgb(color)}, 0.60)`);

    c.save();
    c.fillStyle = grad;
    c.shadowColor = color;
    c.shadowBlur = 6;
    c.fillRect(cx - bodyW / 2, topY, bodyW, barH);
    c.shadowBlur = 0;

    // Tail cap (small rounded end)
    if (tailY >= -NOTE_HEIGHT && !note.tailHit && !note.tailMissed) {
      c.fillStyle = color;
      c.shadowColor = color;
      c.shadowBlur = NOTE_GLOW;
      c.beginPath();
      this._roundedRect(c, cx - noteW / 2, tailY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT * 0.7, NOTE_RADIUS);
      c.fill();
      c.shadowBlur = 0;

      // Tail cap inner marker (distinguishes it from the head)
      c.fillStyle = 'rgba(255,255,255,0.55)';
      c.beginPath();
      c.arc(cx, tailY - NOTE_HEIGHT * 0.1, 4, 0, Math.PI * 2);
      c.fill();
    }
    c.restore();
  }

  _drawNote(c, note, songTime, hitY, laneW, runtimeSpeed) {
    const timeOffset = note.time - songTime;
    const y = hitY - (timeOffset * runtimeSpeed);
    const x = note.lane * laneW;
    const cx = x + laneW / 2;
    const noteW = laneW * 0.55;
    const color = LANE_COLORS[note.lane];

    if (y > hitY + 40) return;

    // For a hold that's actively being held, draw the head clamped at hitY
    // with a glowing held appearance
    if (note.isHold && note.hit && !note.tailHit && !note.tailMissed) {
      // Draw pulsing head at the hit line to indicate active hold
      const pulse = 0.6 + 0.4 * Math.sin(performance.now() / 80);
      c.shadowColor = color;
      c.shadowBlur = NOTE_GLOW * 1.5;
      c.fillStyle = color;
      c.globalAlpha = pulse;
      c.beginPath();
      this._roundedRect(c, cx - noteW / 2, hitY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT, NOTE_RADIUS);
      c.fill();
      c.globalAlpha = 1;
      c.shadowBlur = 0;
      return;
    }

    if (!note.hit) {
      const noteY = y;
      if (noteY < -NOTE_HEIGHT || noteY > hitY + 10) return;

      c.shadowColor = color;
      c.shadowBlur = NOTE_GLOW;

      // Hold heads get a slightly different shape: brighter border
      if (note.isHold) {
        c.fillStyle = color;
        c.beginPath();
        this._roundedRect(c, cx - noteW / 2, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT, NOTE_RADIUS);
        c.fill();

        // Border to distinguish hold head
        c.strokeStyle = 'rgba(255,255,255,0.7)';
        c.lineWidth = 2;
        c.beginPath();
        this._roundedRect(c, cx - noteW / 2, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT, NOTE_RADIUS);
        c.stroke();
      } else {
        c.fillStyle = color;
        c.beginPath();
        this._roundedRect(c, cx - noteW / 2, noteY - NOTE_HEIGHT / 2, noteW, NOTE_HEIGHT, NOTE_RADIUS);
        c.fill();

        // Specular highlight
        c.fillStyle = 'rgba(255,255,255,0.35)';
        c.beginPath();
        this._roundedRect(c, cx - noteW / 2 + 3, noteY - NOTE_HEIGHT / 2 + 3, noteW - 6, NOTE_HEIGHT / 3, 2);
        c.fill();
      }

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
    this._heldHolds = [null, null, null, null];
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