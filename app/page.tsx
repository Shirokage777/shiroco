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
import type { Metadata, Viewport } from "next";

// The zombie stamp icon (Sean, 2026-11-09): browser tab, bookmarks and the iPhone home screen.
// Only this page links it, so the login page gives nothing away. The files themselves load without
// login (middleware.ts), because the iPhone fetches the home-screen icon without the login cookie.
//
// Full screen from the home screen (Sean, 2026-11-13): started from the home-screen icon on an
// iPhone or iPad, the app opens without Safari's address bar and toolbars, like a real app; in
// the browser it stays a normal page. The manifest and the Apple tag below do this; the page keeps
// clear of the clock and the home bar with the safe-area padding (page.module.css).
export const metadata: Metadata = {
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "shiroco", statusBarStyle: "black-translucent" },
  // iOS 17 reads the older Apple name of the full-screen tag; newer Next.js writes only the new one.
  other: { "apple-mobile-web-app-capable": "yes" },
  icons: {
    icon: [
      { url: "/icons/icon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: { url: "/icons/apple-touch-icon.png", sizes: "180x180" },
  },
};

// The page reaches under the clock and the home bar; the padding keeps the content clear of them.
export const viewport: Viewport = { viewportFit: "cover" };

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
