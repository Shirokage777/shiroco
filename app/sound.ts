// The table's sound: card narration, the wind ambience, music (normal or intense) and zombie
// growls, switched on and off in the switch box (sound-box.tsx). Everything plays through one Web Audio graph, so they
// mix: while the narrator speaks, ambience, music and growls duck down.
//
// Browsers only start sound after a tap, so the audio context is opened (or resumed) on the
// first tap after the page loads; switches left on from last time start sounding then.

export type SoundSwitch = "narrate" | "ambience" | "music" | "intense" | "zombies";
export type SoundSettings = Record<SoundSwitch, boolean>;

const STORE = "sound";
const OFF: SoundSettings = { narrate: false, ambience: false, music: false, intense: false, zombies: false };

// Music and Intense music are linked: switching one on switches the other off (Sean, 2026-11-07).
const PARTNER: Partial<Record<SoundSwitch, SoundSwitch>> = { music: "intense", intense: "music" };

// The looping clips, played exactly as the original files; only their volume is set.
const LOOPS = {
  ambience: { url: "/sounds/ambience-wind.mp3", level: 0.75, bus: "ambience" }, // a little under its own volume
  music: { url: "/api/music/zombie-music", level: 0.5, bus: "music" }, // Sean's own track, private (login only)
  intense: { url: "/api/music/zombie-music-intense", level: 0.5, bus: "music" }, // its intense version, likewise
} as const;
type Loop = keyof typeof LOOPS;
const ZOMBIES = Array.from({ length: 7 }, (_, i) => `/sounds/zombie-${i + 1}.mp3`);
const LEVEL = { zombies: 0.6, narration: 1 }; // growls a little lower (Sean, 2026-11-03)
const LOOP_FADE = 3; // seconds a loop crossfades from its end into its start
const DUCK = 0.3; // ambience, music and growls while the narrator speaks
const GROWL_GAP: [number, number] = [14, 40]; // seconds between growls

export const narrationUrl = (cardId: string, clip: "text" | number) =>
  `/api/narration/${encodeURIComponent(cardId)}/${clip === "text" ? "text" : `option-${clip + 1}`}`;

// Settings saved in this browser; anything unreadable counts as all off. Both kinds of music on
// at once can't happen; if the stored settings say so anyway, the normal music wins.
export function parseSettings(raw: string | null): SoundSettings {
  try {
    const value = JSON.parse(raw ?? "{}");
    return {
      narrate: value.narrate === true,
      ambience: value.ambience === true,
      music: value.music === true,
      intense: value.intense === true && value.music !== true,
      zombies: value.zombies === true,
    };
  } catch {
    return { ...OFF };
  }
}

// The settings after flipping one switch: switching Music or Intense music on switches the other off.
export function flip(settings: SoundSettings, which: SoundSwitch): SoundSettings {
  const next = { ...settings, [which]: !settings[which] };
  const partner = PARTNER[which];
  if (partner && next[which]) next[partner] = false;
  return next;
}

// Seconds until the next growl, given a random number in [0, 1).
export const growlDelay = (r: number) => GROWL_GAP[0] + r * (GROWL_GAP[1] - GROWL_GAP[0]);

class Sound {
  settings: SoundSettings = { ...OFF };
  private listeners = new Set<() => void>();
  private ctx: AudioContext | null = null;
  private bus: { narration: GainNode; ambience: GainNode; music: GainNode; zombies: GainNode } | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private speaking: AudioBufferSourceNode | null = null;
  private speech = 0; // id of the latest narration, so a slow download never plays out of turn
  private loops: Partial<Record<Loop, { stop: () => void }>> = {};
  private growlTimer: ReturnType<typeof setTimeout> | null = null;
  private lastGrowl = -1;
  private growlRound = 0; // bumped when Zombies is switched off, so a growl still loading is dropped
  private growls = new Set<{ source: AudioBufferSourceNode; gain: GainNode }>();
  private stopped = false; // signed out: silent for good on this page

  constructor() {
    if (typeof window === "undefined") return;
    try {
      this.settings = parseSettings(localStorage.getItem(STORE));
    } catch {
      // storage blocked: start with everything off
    }
    // Every tap makes sure the switched-on sounds are playing: the first one after the page loads,
    // and the first one after the phone was locked if the browser kept sound held back.
    window.addEventListener(
      "pointerdown",
      () => {
        if (this.stopped || document.hidden || !this.open()) return;
        if (this.settings.ambience) void this.startLoop("ambience");
        if (this.settings.music) void this.startLoop("music");
        if (this.settings.intense) void this.startLoop("intense");
        if (this.settings.zombies) this.scheduleGrowl(true);
      },
      true,
    );
    // Locking the phone or leaving the app pauses all sound; coming back picks it up again.
    const pause = () => {
      if (document.hidden && this.ctx?.state === "running") void this.ctx.suspend();
      else if (!document.hidden && !this.stopped && this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
    };
    document.addEventListener("visibilitychange", pause);
    window.addEventListener("pagehide", () => void this.ctx?.suspend());
  }

  // Signing out: every sound stops at once and nothing starts again on this page.
  stopAll() {
    this.stopped = true;
    this.stopNarration();
    this.stopLoop("ambience");
    this.stopLoop("music");
    this.stopLoop("intense");
    this.stopGrowls();
    void this.ctx?.suspend();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  // Flips a switch; called from a tap, so sound may start right away.
  toggle(which: SoundSwitch) {
    this.settings = flip(this.settings, which);
    try {
      localStorage.setItem(STORE, JSON.stringify(this.settings));
    } catch {
      // not saved: the switch still works for this visit
    }
    this.listeners.forEach((l) => l());
    if (this.stopped || !this.open()) return;
    if (which === "narrate" && !this.settings.narrate) this.stopNarration();
    // The loops follow their switches; a linked switch turned off stops its music too.
    for (const loop of ["ambience", "music", "intense"] as const) {
      if (this.settings[loop]) void this.startLoop(loop);
      else this.stopLoop(loop);
    }
    if (which === "zombies") {
      if (this.settings.zombies) this.scheduleGrowl(true);
      else this.stopGrowls();
    }
  }

  // Reads a clip aloud (if Narrate is on), cutting off whatever was being read.
  async narrate(url: string) {
    this.stopNarration();
    if (!this.settings.narrate || this.stopped || !this.open()) return;
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
      this.bus = { narration: bus(LEVEL.narration), ambience: bus(1), music: bus(1), zombies: bus(LEVEL.zombies) };
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
      [this.bus.music, 1],
      [this.bus.zombies, LEVEL.zombies],
    ] as const) {
      bus.gain.cancelScheduledValues(t);
      bus.gain.setTargetAtTime(full * level, t, 0.25);
    }
  }

  // A looping clip (the wind outside, the music): the recording exactly as it is, only its volume
  // set, nothing added (Sean, 2026-11-03), on a seamless loop.
  private async startLoop(which: Loop) {
    if (this.loops[which] || !this.ctx || !this.bus) return;
    const ctx = this.ctx;
    const out = ctx.createGain();
    out.gain.value = 0;
    out.connect(this.bus[LOOPS[which].bus]);
    const handle = { stop: () => {} };
    this.loops[which] = handle;

    const level = ctx.createGain();
    level.gain.value = LOOPS[which].level;
    level.connect(out);
    const passes = new Set<AudioBufferSourceNode>();
    let nextPass: ReturnType<typeof setTimeout> | null = null;
    handle.stop = () => {
      if (nextPass) clearTimeout(nextPass);
      const t = ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.25);
      setTimeout(() => {
        for (const node of passes) node.stop();
        out.disconnect();
      }, 1500);
    };
    out.gain.setTargetAtTime(1, ctx.currentTime, 0.6);

    // The loop is made seamless here, not in the file: each pass fades out over its last seconds
    // while the next pass fades in from the start.
    const buffer = await this.load(LOOPS[which].url);
    if (!buffer || this.loops[which] !== handle) return;
    const fade = Math.min(LOOP_FADE, buffer.duration / 4);
    const pass = (at: number, offset: number) => {
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      const gain = ctx.createGain();
      const end = at + buffer.duration - offset;
      gain.gain.setValueAtTime(0, at);
      gain.gain.linearRampToValueAtTime(1, at + fade);
      gain.gain.setValueAtTime(1, end - fade);
      gain.gain.linearRampToValueAtTime(0, end);
      source.connect(gain).connect(level);
      source.onended = () => passes.delete(source);
      passes.add(source);
      source.start(at, offset);
      // Lay the next pass a second before this one starts fading out.
      nextPass = setTimeout(() => pass(end - fade, 0), (end - fade - ctx.currentTime - 1) * 1000);
    };
    pass(ctx.currentTime, 0);
  }

  private stopLoop(which: Loop) {
    this.loops[which]?.stop();
    delete this.loops[which];
  }

  // Now and then a growl, from a random direction and never the same one twice running. Right
  // after switching on, the first comes within seconds, so you know it works.
  private scheduleGrowl(soon = false) {
    if (this.growlTimer) return;
    const delay = soon ? 2 + Math.random() * 3 : growlDelay(Math.random());
    this.growlTimer = setTimeout(async () => {
      this.growlTimer = null;
      if (!this.settings.zombies || !this.ctx || !this.bus) return;
      if (this.ctx.state !== "running") return this.scheduleGrowl(); // paused: no growls piling up for later
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
