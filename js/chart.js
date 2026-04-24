/**
 * ZeBongo Chart Parser
 * Converts the canonical .json chart format into runtime note objects.
 * Beat-based storage → millisecond-based runtime.
 * 
 * Note schema:
 *   { beat, lane }  →  { time, lane, hit, missed }
 */

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
    this.totalNotes = this.notes.length;
    this.durationSeconds = (this.durationBeats / this.bpm) * 60;
  }

  _parse(rawNotes, bpm) {
    const secPerBeat = 60 / bpm;
    return rawNotes
      .map(n => ({
        id: Math.random().toString(36).slice(2),
        // Editor convention: beat 1 is the first beat (downbeat 1 = song time 0).
        // Runtime convention used to be beat * secPerBeat which is off by one
        // full beat (~470ms at 128 BPM). Align them by subtracting 1.
        time: (n.beat - 1) * secPerBeat,
        lane: n.lane,
        // Runtime state (mutated by engine)
        hit: false,
        missed: false,
      }))
      .sort((a, b) => a.time - b.time);
  }

  reset() {
    this.notes.forEach(n => {
      n.hit = false;
      n.missed = false;
    });
  }

  /**
   * Returns notes within a lookahead window for rendering.
   * Future: this will be the entry point for server-synced charts.
   */
  getNotesInWindow(songTime, lookAheadSeconds) {
    const windowEnd = songTime + lookAheadSeconds;
    return this.notes.filter(n =>
      !n.missed &&
      !n.hit &&
      n.time <= windowEnd
    );
  }
}

export async function loadChart(url) {
  const res = await fetch(url);
  const data = await res.json();
  return new Chart(data);
}