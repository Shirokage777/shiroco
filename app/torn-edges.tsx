"use client";

import { useEffect } from "react";
import { tornClipPath } from "./torn-edge";
import table from "./table.module.css";

// Gives every paper note on the page its torn outline (torn-edge.ts), as the CSS variable
// --torn that .paper::before clips to. Notes come and go with the game, so new ones are
// picked up as they appear; a note's outline is worked out again only when its size changes.
// Size changes are seen after layout and before paint, so a note never shows untorn.
export default function TornEdges() {
  useEffect(() => {
    const sizes = new ResizeObserver((entries) => {
      for (const { target, borderBoxSize } of entries) {
        const { inlineSize: w, blockSize: h } = borderBoxSize[0];
        (target as HTMLElement).style.setProperty("--torn", tornClipPath(w, h));
      }
    });
    const watch = (root: ParentNode) => {
      if (root instanceof Element && root.classList.contains(table.paper)) sizes.observe(root);
      root.querySelectorAll(`.${table.paper}`).forEach((note) => sizes.observe(note));
    };
    watch(document);
    const added = new MutationObserver((changes) => {
      for (const change of changes) change.addedNodes.forEach((node) => node instanceof Element && watch(node));
    });
    added.observe(document.body, { childList: true, subtree: true });
    return () => {
      added.disconnect();
      sizes.disconnect();
    };
  }, []);
  return null;
}
