// The table's sound: card narration, the wind ambience and zombie growls, switched on and off
// in the switch box (sound-box.tsx). Everything plays through one Web Audio graph, so the three
// mix: while the narrator speaks, ambience and growls duck down.
//
// Browsers only start sound after a tap, so the audio context is opened (or resumed) on the
// first tap after the page loads; switches left on from last time start sounding then.

export type SoundSwitch = "narrate" | "ambience" | "zombies";
export type SoundSettings = Record<SoundSwitch, boolean>;

const STORE = "sound";
const OFF: SoundSettings = { narrate: false, ambience: false, zombies: false };

const WIND = "/sounds/ambience-wind.mp3";
const ZOMBIES = Array.from({ length: 7 }, (_, i) => `/sounds/zombie-${i + 1}.mp3`);
// Ambience a little under the clip's own volume, growls a little lower too (Sean, 2026-11-03).
const LEVEL = { wind: 0.75, zombies: 0.6, narration: 1 };
const WIND_FADE = 3; // seconds the wind loop crossfades from its end into its start
const DUCK = 0.3; // ambience and growls while the narrator speaks
const GROWL_GAP: [number, number] = [14, 40]; // seconds between growls

export const narrationUrl = (cardId: string, clip: "text" | number) =>
  `/api/narration/${encodeURIComponent(cardId)}/${clip === "text" ? "text" : `option-${clip + 1}`}`;

// Settings saved in this browser; anything unreadable counts as all off.
export function parseSettings(raw: string | null): SoundSettings {
  try {
    const value = JSON.parse(raw ?? "{}");
    return { narrate: value.narrate === true, ambience: value.ambience === true, zombies: value.zombies === true };
  } catch {
    return { ...OFF };
  }
}

// Seconds until the next growl, given a random number in [0, 1).
export const growlDelay = (r: number) => GROWL_GAP[0] + r * (GROWL_GAP[1] - GROWL_GAP[0]);

class Sound {
  settings: SoundSettings = { ...OFF };
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private bus: { narration: GainNode; ambience: GainNode; zombies: GainNode } | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private speaking: AudioBufferSourceNode | null = null;
  private speech = 0; // id of the latest narration, so a slow download never plays out of turn
  private ambience: { stop: () => void } | null = null;
  private growlTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGrowl = -1;
  private growlRound = 0; // bumped when Zombies is switched off, so a growl still loading is dropped
  private growls = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.settings = parseSettings(localStorage.getItem(STORE));
    } catch {
      // storage blocked: start with everything off
    }
    const wake = () => {
      if (!this.open()) return;
      if (this.settings.ambience) void this.startAmbience();
      if (this.settings.zombies) this.scheduleGrowl(true);
      window.removeEventListener("pointerdown", wake, true);
    };
    window.addEventListener("pointerdown", wake, true);
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // Flips a switch; called from a tap, so sound may start right away.
  toggle(which: SoundSwitch) {
    this.settings = { ...this.settings, [which]: !this.settings[which] };
    try {
      localStorage.setItem(STORE, JSON.stringify(this.settings));
    } catch {
      // not saved: the switch still works for this visit
    }
    this.listeners.forEach((l) => l());
    if (!this.open()) return;
    if (which === "narrate" && !this.settings.narrate) this.stopNarration();
    if (which === "ambience") {
      if (this.settings.ambience) void this.startAmbience();
      else this.stopAmbience();
    }
    if (which === "zombies") {
      if (this.settings.zombies) this.scheduleGrowl(true);
      else this.stopGrowls();
    }
  }

  // Reads a clip aloud (if Narrate is on), cutting off whatever was being read.
  async narrate(url: string) {
    this.stopNarration();
    if (!this.settings.narrate || !this.open()) return;
    const id = ++this.speech;
    const buffer = await this.load(url);
    if (!buffer || id !== this.speech || !this.ctx || !this.bus) return;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(this.bus.narration);
    source.onended = () => {
      if (this.speaking === source) {
        this.speaking = null;
        this.duck(false);
      }
    };
    this.speaking = source;
    this.duck(true);
    source.start();
  }

  stopNarration() {
    this.speech++;
    if (this.speaking) {
      this.speaking.onended = null;
      this.speaking.stop();
      this.speaking = null;
      this.duck(false);
    }
  }

  // Opens the audio graph on the first tap; false while the browser still holds sound back.
  private open(): boolean {
    if (!this.ctx) {
      try {
        // iOS: play like media, even with the ringer switch on silent.
        const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
        if (session) session.type = "playback";
        this.ctx = new AudioContext();
      } catch {
        return false;
      }
      const bus = (level: number) => {
        const gain = this.ctx!.createGain();
        gain.gain.value = level;
        gain.connect(this.ctx!.destination);
        return gain;
      };
      this.bus = { narration: bus(LEVEL.narration), ambience: bus(1), zombies: bus(LEVEL.zombies) };
    }
    if (this.ctx.state === "suspended") void this.ctx.resume();
    return true;
  }

  private load(url: string) {
    let buffer = this.buffers.get(url);
    if (!buffer) {
      buffer = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : Promise.reject(res.status)))
        .then((data) => this.ctx!.decodeAudioData(data))
        .catch(() => {
          this.buffers.delete(url); // try again next time
          return null;
        });
      this.buffers.set(url, buffer);
    }
    return buffer;
  }

  private duck(down: boolean) {
    if (!this.ctx || !this.bus) return;
    const level = down ? DUCK : 1;
    const t = this.ctx.currentTime;
    for (const [bus, full] of [
      [this.bus.ambience, 1],
      [this.bus.zombies, LEVEL.zombies],
    ] as const) {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(full * level, t, 0.25);
    }
  }

  // The wind outside: the recording exactly as it is, only its volume set, on a seamless loop. Nothing is
  // added to it (Sean, 2026-11-03: a generated snow hiss spoiled it).
  private async startAmbience() {
    if (this.ambience || !this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bus.ambience);
    const handle = { stop: () => {} };
    this.ambience = handle;

    const windGain = ctx.createGain();
    windGain.gain.value = LEVEL.wind;
    windGain.connect(out);
    const winds = new Set<AudioBufferSourceNode>();
    let nextPass: ReturnType<typeof setTimeout> | null = null;
    handle.stop = () => {
      if (nextPass) clearTimeout(nextPass);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => {
        for (const node of winds) node.stop();
        out.disconnect();
      }, 1500);
    };
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);

    // The loop is made seamless here, not in the file: each pass fades out over its last seconds
    // while the next pass fades in from the start.
    const buffer = await this.load(WIND);
    if (!buffer || this.ambience !== handle) return;
    const fade = Math.min(WIND_FADE, buffer.duration / 4);
    const pass = (at: number, offset: number) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const end = at + buffer.duration - offset;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + fade);
      gain.gain.setValueAtTime(1, end - fade);
      gain.gain.linearRampToValueAtTime(0, end);
      source.connect(gain).connect(windGain);
      source.onended = () => winds.delete(source);
      winds.add(source);
      source.start(at, offset);
      // Lay the next pass a second before this one starts fading out.
      nextPass = setTimeout(() => pass(end - fade, 0), (end - fade - ctx.currentTime - 1) * 1000);
    };
    pass(ctx.currentTime, 0);
  }

  private stopAmbience() {
    this.ambience?.stop();
    this.ambience = null;
  }

  // Now and then a growl, from a random direction and never the same one twice running. Right
  // after switching on, the first comes within seconds, so you know it works.
  private scheduleGrowl(soon = false) {
    if (this.growlTimer) return;
    const delay = soon ? 2 + Math.random() * 3 : growlDelay(Math.random());
    this.growlTimer = setTimeout(async () => {
      this.growlTimer = null;
      if (!this.settings.zombies || !this.ctx || !this.bus) return;
      let pick = Math.floor(Math.random() * ZOMBIES.length);
      if (pick === this.lastGrowl) pick = (pick + 1) % ZOMBIES.length;
      this.lastGrowl = pick;
      const round = this.growlRound;
      const buffer = await this.load(ZOMBIES[pick]);
      if (round !== this.growlRound) return; // switched off (or off and on) while it loaded
      if (buffer) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.9 + Math.random() * 0.15;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5 + Math.random() * 0.5;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 1.6 - 0.8;
        source.connect(gain).connect(pan).connect(this.bus.zombies);
        const growl = { source, gain };
        this.growls.add(growl);
        source.onended = () => this.growls.delete(growl);
        source.start();
      }
      this.scheduleGrowl();
    }, delay * 1000);
  }

  // Switching Zombies off silences them at once: the growl playing is cut (with a fade too
  // short to hear, so it does not click) and no further one comes.
  private stopGrowls() {
    if (this.growlTimer) clearTimeout(this.growlTimer);
    this.growlTimer = null;
    this.growlRound++;
    const t = this.ctx?.currentTime ?? 0;
    for (const { source, gain } of this.growls) {
      gain.gain.cancelScheduledValues(t);
      gain.gain.setTargetAtTime(0, t, 0.015);
      source.stop(t + 0.08);
    }
    this.growls.clear();
  }
}

export const sound = new Sound();
