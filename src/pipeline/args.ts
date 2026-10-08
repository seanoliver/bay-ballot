export function badFlag(args: string[], known: string[]): string | null {
  const seen = new Set<string>();
  for (const a of args) {
    if (!a.startsWith("--")) continue;
    if (seen.has(a)) return `${a} given twice`;
    seen.add(a);
    const eq = a.indexOf("=");
    const name = eq < 0 ? a : a.slice(0, eq);
    if (eq >= 0 && known.includes(name)) return `use '${name} ${a.slice(eq + 1)}', not '${a}'`;
    if (!known.includes(a)) return `unknown option ${a}`;
  }
  return null;
}
