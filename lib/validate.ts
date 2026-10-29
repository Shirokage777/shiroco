// Checks a deck's shape and returns a list of problems (empty when the deck is fine).
export function validateDeck(deck: unknown): string[] {
  const problems: string[] = [];
  const d = deck as { cards?: unknown[]; count?: number };
  if (!Array.isArray(d?.cards) || d.cards.length === 0) return ["deck has no cards"];
  if (d.count !== d.cards.length) problems.push(`count ${d.count} does not match ${d.cards.length} cards`);

  const ids = new Set<string>();
  for (const [i, raw] of d.cards.entries()) {
    const c = raw as Record<string, unknown>;
    const at = `card ${i} (${String(c.id)})`;
    for (const key of ["id", "set", "title", "trigger", "text"]) {
      if (typeof c[key] !== "string" || !(c[key] as string).trim()) problems.push(`${at}: missing ${key}`);
    }
    if (typeof c.mature !== "boolean" || typeof c.noCoop !== "boolean") problems.push(`${at}: mature/noCoop must be true or false`);
    const options = c.options as { label?: unknown; text?: unknown }[] | undefined;
    if (!Array.isArray(options) || options.length === 0) {
      problems.push(`${at}: no options`);
    } else if (options.some((o) => typeof o.label !== "string" || typeof o.text !== "string" || !o.text)) {
      problems.push(`${at}: an option is missing its label or text`);
    }
    if (ids.has(c.id as string)) problems.push(`${at}: duplicate id`);
    ids.add(c.id as string);
  }
  return problems;
}
