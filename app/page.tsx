// Fonts are bundled from npm (no request to Google at build or run time).
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/barlow-condensed/latin-500.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-400-italic.css";
import "@fontsource/courier-prime/latin-700.css";
import "@fontsource/courier-prime/latin-700-italic.css";
import SignOut from "./sign-out";
import SoundBox from "./sound-box";
import Table from "./table";
import TornEdges from "./torn-edges";
import styles from "./page.module.css";
import type { Metadata } from "next";

// The zombie stamp icon (Sean, 2026-11-09): browser tab, bookmarks and the iPhone home screen.
// Only this page links it, so the login page gives nothing away. The files themselves load without
// login (middleware.ts), because the iPhone fetches the home-screen icon without the login cookie.
export const metadata: Metadata = {
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
};

// Abandoned bunker look (Sean's pick, 2026-10-30): concrete, rust, hazard stripes, typewriter notices.
// Only this page carries it; the login page stays neutral.

// Reached only with a valid session (see middleware.ts).
export default function Home() {
  return (
    <div className={styles.bunker}>
      {/* Torn outlines for the paper notes (torn-edges.tsx). */}
      <TornEdges />
      <div className={styles.hazard} aria-hidden="true" />
      <main className={styles.page}>
        <div className={styles.soundRow}>
          <SoundBox />
        </div>
        <Table />
      </main>
      <footer className={styles.footer}>
        <SignOut />
      </footer>
      <div className={`${styles.hazard} ${styles.hazardBottom}`} aria-hidden="true" />
    </div>
  );
}
