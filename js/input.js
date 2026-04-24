/**
 * ZeBongo Input Handler
 * Manages keyboard and touch input for 4 lanes.
 * Emits clean events: { lane, type: 'press'|'release', time }
 * Designed for future online play - all times are AudioContext-relative.
 */

export class InputHandler {
  constructor(audioEngine) {
    this.audio = audioEngine;
    this.listeners = { press: [], release: [] };
    this.heldLanes = new Set();

    // Default key map - easily configurable per player profile later
    this.keyMap = {
      'd': 0,
      'f': 1,
      'j': 2,
      'k': 3,
    };

    this._onKeyDown = this._onKeyDown.bind(this);
    this._onKeyUp = this._onKeyUp.bind(this);
    this._onTouchStart = this._onTouchStart.bind(this);
    this._onTouchEnd = this._onTouchEnd.bind(this);
  }

  attach() {
    document.addEventListener('keydown', this._onKeyDown);
    document.addEventListener('keyup', this._onKeyUp);
    // Touch targets attached separately via attachTouchZones()
  }

  detach() {
    document.removeEventListener('keydown', this._onKeyDown);
    document.removeEventListener('keyup', this._onKeyUp);
  }

  attachTouchZones(elements) {
    // elements: array of 4 DOM elements, one per lane
    elements.forEach((el, lane) => {
      el.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this._emit('press', lane);
      }, { passive: false });
      el.addEventListener('touchend', (e) => {
        e.preventDefault();
        this._emit('release', lane);
      }, { passive: false });
      // Mouse fallback for non-touch
      el.addEventListener('mousedown', () => this._emit('press', lane));
      el.addEventListener('mouseup', () => this._emit('release', lane));
    });
  }

  on(event, fn) {
    this.listeners[event]?.push(fn);
    return () => this.off(event, fn); // returns unsubscribe fn
  }

  off(event, fn) {
    if (this.listeners[event]) {
      this.listeners[event] = this.listeners[event].filter(f => f !== fn);
    }
  }

  setKeyMap(map) {
    this.keyMap = map;
  }

  _onKeyDown(e) {
    if (e.repeat) return; // ignore held keys
    const lane = this.keyMap[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    this._emit('press', lane);
  }

  _onKeyUp(e) {
    const lane = this.keyMap[e.key.toLowerCase()];
    if (lane === undefined) return;
    e.preventDefault();
    this._emit('release', lane);
  }

  _onTouchStart(lane) {
    this._emit('press', lane);
  }

  _onTouchEnd(lane) {
    this._emit('release', lane);
  }

  _emit(type, lane) {
    // Time is relative to AudioContext for precision sync
    // Falls back to performance.now() if audio isn't running yet
    const time = this.audio?.getCurrentTime?.() ?? (performance.now() / 1000);
    const event = { lane, type, time };
    this.heldLanes[type === 'press' ? 'add' : 'delete'](lane);
    this.listeners[type]?.forEach(fn => fn(event));
  }

  isHeld(lane) {
    return this.heldLanes.has(lane);
  }

  destroy() {
    this.detach();
    this.listeners = { press: [], release: [] };
  }
}