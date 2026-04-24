/**
 * ZeBongo Chart Parser
 * Converts the canonical .json chart format into runtime note objects.
 * Beat-based storage → millisecond-based runtime.
 *
 * Tap note schema (legacy, fully supported):
 *   { beat, lane }
 *
 * Hold note schema (new):
 *   { beat, lane, duration }   ← duration in beats; omitted / 0 = tap note
 *
 * Runtime note objects gain:
 *   { time, lane, duration, isHold, tailTime, hit, missed, tailHit, tailMissed }
 *
 * "isHold" is true only when the stored duration converts to ≥ MIN_HOLD_SECONDS.
 * Notes shorter than that threshold are silently treated as tap notes, so old
 * charts with no duration field continue working exactly as before.
 */

// Any hold whose audio duration is shorter than this is collapsed into a tap.
const MIN_HOLD_SECONDS = 0.15;

export class Chart {
  constructor(data) {
    this.id = data.id;
    this.title = data.title;
    this.artist = data.artist;
    this.audioUrl = data.audioUrl;
    this.bpm = data.bpm;
    this.offset = data.offset ?? 0;
    this.difficulty = data.difficulty ?? 1;
    this.noteSpeed = data.noteSpeed ?? 1.0;
    this.hpMode = data.hpMode ?? 'Normal';
    this.durationBeats = data.durationBeats ?? 0;
    this.notes = this._parse(data.notes, data.bpm);
    // totalNotes counts every judgeable event:
    //   tap note  = 1 judgement
    //   hold note = 2 judgements (head press + tail release)
    this.totalNotes = this.notes.reduce((s, n) => s + (n.isHold ? 2 : 1), 0);
    this.durationSeconds = (this.durationBeats / this.bpm) * 60;
  }

  _parse(rawNotes, bpm) {
    const secPerBeat = 60 / bpm;
    return rawNotes
      .map(n => {
        const headTime = (n.beat - 1) * secPerBeat;
        const durSec   = (n.duration ?? 0) * secPerBeat;
        const isHold   = durSec >= MIN_HOLD_SECONDS;
        return {
          id: Math.random().toString(36).slice(2),
          time: headTime,
          lane: n.lane,
          duration: n.duration ?? 0,          // beats (raw, for editor round-trips)
          durationSec: isHold ? durSec : 0,   // seconds (used by engine)
          tailTime: isHold ? headTime + durSec : headTime,
          isHold,
          // Runtime state (mutated by engine)
          hit: false,       // head pressed
          missed: false,    // head never pressed in time
          tailHit: false,   // tail released
          tailMissed: false,// tail window expired or head was missed
        };
      })
      .sort((a, b) => a.time - b.time);
  }

  reset() {
    this.notes.forEach(n => {
      n.hit = false;
      n.missed = false;
      n.tailHit = false;
      n.tailMissed = false;
    });
  }

  /**
   * Returns notes within a lookahead window for rendering.
   *
   * Entry condition  — always keyed on n.time (the head), so a hold note
   *   scrolls into view from the top of the screen at the same moment a tap
   *   note of equivalent timing would.  Using tailTime here was the bug that
   *   caused holds to snap into view late (or never appear at all when the
   *   tail was beyond the lookahead distance).
   *
   * Exit condition — a hold stays in the list until its tail is fully resolved
   *   so the body bar keeps rendering while the player holds the key.
   */
  getNotesInWindow(songTime, lookAheadSeconds) {
    const windowEnd = songTime + lookAheadSeconds;
    return this.notes.filter(n => {
      // Fully resolved — nothing left to draw
      if (n.missed && !n.isHold) return false;
      if (n.missed && n.isHold && n.tailMissed) return false;
      if (n.hit && !n.isHold) return false;
      if (n.hit && n.isHold && (n.tailHit || n.tailMissed)) return false;

      // Entry: note head must be within the lookahead window
      if (n.time > windowEnd) return false;

      // Exit: for holds, keep rendering until the tail has scrolled past
      // the hit line (a small grace margin so the tail cap doesn't pop out)
      if (n.isHold && n.tailTime < songTime - 0.1) return false;

      return true;
    });
  }
}

export async function loadChart(url) {
  const res = await fetch(url);
  const data = await res.json();
  return new Chart(data);
}