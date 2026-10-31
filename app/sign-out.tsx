"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { SHRINK_MS } from "./table";
import table from "./table.module.css";

// Asks first, on a note like the new-game question: a misclick should never end the session.
// The note grows out of the button and shrinks back into it, whichever answer is given.
export default function SignOut() {
  const router = useRouter();
  const [asking, setAsking] = useState(false);
  const [closing, setClosing] = useState(false);

  function close(then?: () => void) {
    const finish = () => {
      setClosing(false);
      setAsking(false);
      then?.();
    };
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return finish();
    setClosing(true);
    window.setTimeout(finish, SHRINK_MS);
  }

  async function signOut() {
    await fetch("/api/logout", { method: "POST" });
    router.replace("/login");
  }

  if (!asking) return <button onClick={() => setAsking(true)}>Sign out</button>;

  return (
    <div className={table.table}>
      <div className={table.pin}>
        <div className={`${table.ask} ${table.paper} ${closing ? table.shrinkToBottom : table.growFromBottom}`} role="alertdialog" aria-label="Sign out?">
          <span>Do you really want to sign out?</span>
          <button className={table.primary} onClick={() => close(signOut)}>Yes, sign out</button>
          <button className={`${table.secondary} ${table.cancel}`} onClick={() => close()}>Cancel</button>
        </div>
      </div>
    </div>
  );
}
