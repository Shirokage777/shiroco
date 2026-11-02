// The table's sound: card narration, the storm ambience and zombie growls, switched on and off
// in the switch box (sound-box.tsx). Everything plays through one Web Audio graph, so the three
// mix: while the narrator speaks, ambience and growls duck down.
//
// Browsers only start sound after a tap, so the audio context is opened (or resumed) on the
// first tap after the page loads; switches left on from last time start sounding then.

export type SoundSwitch = "narrate" | "ambience" | "zombies";
export type SoundSettings = Record<SoundSwitch, boolean>;

const STORE = "sound";
const OFF: SoundSettings = { narrate: false, ambience: false, zombies: false };

const WIND = "/sounds/storm-wind.mp3";
const ZOMBIES = Array.from({ length: 7 }, (_, i) => `/sounds/zombie-${i + 1}.mp3`);
const LEVEL = { wind: 0.55, snow: 0.07, zombies: 0.7, narration: 1 };
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

  // The storm: the recorded wind on a seamless loop, and fine snow hissing over it in gusts.
  private async startAmbience() {
    if (this.ambience || !this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bus.ambience);
    const handle = { stop: () => {} };
    this.ambience = handle;

    // Snow: filtered noise, its loudness swaying with two slow, unrelated gust rhythms.
    const noise = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const snow = ctx.createBufferSource();
    snow.buffer = noise;
    snow.loop = true;
    const high = ctx.createBiquadFilter();
    high.type = "highpass";
    high.frequency.value = 2800;
    const band = ctx.createBiquadFilter();
    band.type = "peaking";
    band.frequency.value = 6500;
    band.gain.value = 6;
    const snowGain = ctx.createGain();
    snowGain.gain.value = LEVEL.snow;
    const gusts = [0.11, 0.29].map((rate, i) => {
      const lfo = ctx.createOscillator();
      lfo.frequency.value = rate;
      const depth = ctx.createGain();
      depth.gain.value = LEVEL.snow * (i === 0 ? 0.6 : 0.35);
      lfo.connect(depth).connect(snowGain.gain);
      lfo.start();
      return lfo;
    });
    snow.connect(high).connect(band).connect(snowGain).connect(out);
    snow.start();

    const windGain = ctx.createGain();
    windGain.gain.value = LEVEL.wind;
    windGain.connect(out);
    let wind: AudioBufferSourceNode | null = null;
    handle.stop = () => {
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => {
        for (const node of [snow, wind, ...gusts]) node?.stop();
        out.disconnect();
      }, 1500);
    };
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);

    const buffer = await this.load(WIND);
    if (!buffer || this.ambience !== handle) return;
    wind = ctx.createBufferSource();
    wind.buffer = buffer;
    wind.loop = true;
    wind.connect(windGain);
    wind.start(0, Math.random() * buffer.duration); // start somewhere in the storm, not always at 0
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
      const buffer = await this.load(ZOMBIES[pick]);
      if (buffer && this.settings.zombies) {
        const source = this.ctx.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 0.9 + Math.random() * 0.15;
        const gain = this.ctx.createGain();
        gain.gain.value = 0.5 + Math.random() * 0.5;
        const pan = this.ctx.createStereoPanner();
        pan.pan.value = Math.random() * 1.6 - 0.8;
        source.connect(gain).connect(pan).connect(this.bus.zombies);
        source.start();
      }
      this.scheduleGrowl();
    }, delay * 1000);
  }

  private stopGrowls() {
    if (this.growlTimer) clearTimeout(this.growlTimer);
    this.growlTimer = null;
  }
}

export const sound = new Sound();
