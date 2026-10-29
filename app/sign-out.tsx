"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import table from "./table.module.css";

// Asks first, on a note like the new-game question: a misclick should never end the session.
export default function SignOut() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!asking) return <button onClick={() => setAsking(true)}>Sign out</button>;

  return (
    <div className={table.table}>
      <div className={table.pin}>
        <div className={`${table.ask} ${table.paper}`} role="alertdialog" aria-label="Sign out?">
          <span>Do you really want to sign out?</span>
          <button className={table.primary} onClick={signOut}>Yes, sign out</button>
          <button className={table.secondary} onClick={() => setAsking(false)}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
