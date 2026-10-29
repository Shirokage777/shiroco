// Fonts are bundled from npm (no request to Google at build or run time).
import "@fontsource/special-elite/latin-400.css";
import "@fontsource/courier-prime/latin-400.css";
import "@fontsource/courier-prime/latin-400-italic.css";
import "@fontsource/courier-prime/latin-700.css";
import "@fontsource/courier-prime/latin-700-italic.css";
import SignOut from "./sign-out";
import Table from "./table";
import styles from "./page.module.css";

// Abandoned bunker look (Sean's pick, 2026-10-30): concrete, rust, hazard stripes, typewriter notices.
// Only this page carries it; the login page stays neutral.

// Reached only with a valid session (see middleware.ts).
export default function Home() {
  return (
    <div className={styles.bunker}>
      <div className={styles.hazard} aria-hidden="true" />
      <main className={styles.page}>
        <Table />
      </main>
      <footer className={styles.footer}>
        <SignOut />
      </footer>
    </div>
  );
}
