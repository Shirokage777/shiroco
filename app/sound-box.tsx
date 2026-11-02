"use client";

import { useSyncExternalStore } from "react";
import { sound, type SoundSettings, type SoundSwitch } from "./sound";
import styles from "./sound-box.module.css";

const SWITCHES: [SoundSwitch, string][] = [
  ["narrate", "Narrate"],
  ["ambience", "Ambience"],
  ["music", "Music"],
  ["zombies", "Zombies"],
];
const ALL_OFF: SoundSettings = { narrate: false, ambience: false, music: false, zombies: false };

// A small steel switch box on the wall, like the breaker panel: a lever and a lamp per sound.
// Lever up and lamp lit means on. Flips at once on tap.
export default function SoundBox() {
  const settings = useSyncExternalStore(sound.subscribe, () => sound.settings, () => ALL_OFF);
  return (
    <div className={styles.box} role="group" aria-label="Sound">
      <span className={styles.plate} aria-hidden="true">
        Sound
      </span>
      <div className={styles.switches}>
        {SWITCHES.map(([key, label]) => (
          <button
            key={key}
            role="switch"
            aria-checked={settings[key]}
            className={`${styles.switch} ${settings[key] ? styles.on : ""}`}
            onClick={() => sound.toggle(key)}
          >
            <span className={styles.slot} aria-hidden="true">
              <span className={styles.lever} />
            </span>
            <span className={styles.lamp} aria-hidden="true" />
            <span className={styles.label}>{label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
