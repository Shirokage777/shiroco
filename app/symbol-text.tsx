"use client";

import { useState } from "react";
import { splitSymbols } from "@/lib/deck";
import styles from "./table.module.css";

// A printed game symbol, cropped from the real cards and served only after login.
// Without the image (e.g. the example deck) the symbol's name shows instead.
export function Symbol({ name, className }: { name: string; className?: string }) {
  const [missing, setMissing] = useState(false);
  if (missing) return <span className={styles.symbolWord}>{name}</span>;
  return (
    // Plain <img>: the route is private and small; next/image would add a public optimizer URL.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={`/api/symbols/${name}`} alt={name} title={name} className={className ?? styles.symbol} onError={() => setMissing(true)} />
  );
}

export function SymbolText({ text }: { text: string }) {
  return (
    <>
      {splitSymbols(text).map((part, i) => ("symbol" in part ? <Symbol key={i} name={part.symbol} /> : <span key={i}>{part.text}</span>))}
    </>
  );
}
