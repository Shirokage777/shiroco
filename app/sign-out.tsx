"use client";

import { useState } from "react";
import { sound } from "./sound";
import { SHRINK_MS } from "./table";
import table from "./table.module.css";

// Asks first, on a note like the new-game question: a misclick should never end the session.
// The note grows out of the button and shrinks back into it, whichever answer is given.
export default function SignOut() {
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

  // All sound stops at once; then a full page load to the login, so nothing of the game (and no
  // sound) lives on in the page.
  async function signOut() {
    sound.stopAll();
    await fetch("/api/logout", { method: "POST" });
    window.location.replace("/login");
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
