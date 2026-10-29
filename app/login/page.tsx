"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import styles from "./login.module.css";

// Names nothing about the content: just a name, a password and a button.
export default function Login() {
  const router = useRouter();
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    const form = new FormData(event.currentTarget);
    const res = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), password: form.get("password") }),
    });
    setBusy(false);
    if (res.ok) router.replace("/");
    else setFailed(true);
  }

  return (
    <main className={styles.page}>
      <form className={styles.form} onSubmit={submit}>
        <input name="name" autoComplete="username" placeholder="Name" aria-label="Name" required />
        <input name="password" type="password" autoComplete="current-password" placeholder="Password" aria-label="Password" required />
        <button type="submit" disabled={busy}>Enter</button>
        {failed && <p role="alert">Wrong name or password.</p>}
      </form>
    </main>
  );
}
