import SignOut from "./sign-out";
import Table from "./table";
import styles from "./page.module.css";

// Reached only with a valid session (see middleware.ts).
export default function Home() {
  return (
    <main className={styles.page}>
      <Table />
      <footer className={styles.footer}>
        <SignOut />
      </footer>
    </main>
  );
}
