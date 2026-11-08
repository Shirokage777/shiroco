import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { clean, leaks } from "../scripts/export-agent.mjs";

// The builder agent ships with the app: clone the repo, start Claude Code, and it is there.
const AGENT = [
  "CLAUDE.md",
  ".claude/rules/approval-before-outward.md",
  ".claude/rules/secrets.md",
  "agent/preferences.md",
  "agent/privacy.md",
];

describe("the public builder agent", () => {
  it("is complete", () => {
    expect(AGENT.filter((f) => !existsSync(f))).toEqual([]);
  });

  it("holds nothing personal: no IDs, local paths, e-mail addresses or private lines", () => {
    const files = Object.fromEntries(AGENT.map((f) => [f, readFileSync(f, "utf8")]));
    expect(leaks(files)).toEqual([]);
  });

  it("export leaves out private lines and replaces the owner's name", () => {
    const text = "# Ann's notes\n- Ann likes grey. <!-- private -->\n- Done. Ann chose it; it is Ann's call.";
    expect(clean(text, "Ann")).toBe("# The owner's notes\n- Done. The owner chose it; it is the owner's call.");
  });

  it("export check finds leaks", () => {
    const found = leaks({ "x.md": "page 12345678-1234-1234-1234-123456789abc, mail a@b.com, Ann, secret word" }, ["secret word"], "Ann");
    expect(found).toHaveLength(4);
  });
});
