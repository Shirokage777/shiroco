"use client";

import { useEffect } from "react";
import { settleFullScreen } from "./full-screen";

// Runs the iPhone full-screen fix (full-screen.ts) at launch and every time the app comes back.
export default function FullScreenFix() {
  useEffect(() => {
    const settle = () => void settleFullScreen(window);
    const back = () => document.visibilityState === "visible" && settle();
    settle();
    window.addEventListener("pageshow", settle);
    document.addEventListener("visibilitychange", back);
    return () => {
      window.removeEventListener("pageshow", settle);
      document.removeEventListener("visibilitychange", back);
    };
  }, []);
  return null;
}
