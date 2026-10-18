// Rozdelí Markdown na chunky podľa nadpisov a odsekov.
// Každý chunk začína cestou nadpisov (napr. "Docker > Storage"), takže:
//  - nadpis sa nelepí na koniec predchádzajúceho chunku,
//  - chunk nesie kontext, o čom je (pomáha vektorom aj full-textu).
export function chunkMarkdown(text: string, maxChars = 800): string[] {
  const sections: { label: string; body: string }[] = [];
  const path: string[] = [];
  let lines: string[] = [];
  let inCode = false;

  const flush = () => {
    const body = lines.join("\n").trim();
    if (body) sections.push({ label: path.filter(Boolean).join(" > "), body });
    lines = [];
  };

  for (const line of text.split("\n")) {
    if (line.trim().startsWith("```")) inCode = !inCode;
    const m = inCode ? null : line.match(/^(#{1,6})\s+(.*)$/);
    if (m) {
      flush();
      const level = m[1].length;
      path.splice(level - 1);
      path[level - 1] = m[2].trim();
    } else {
      lines.push(line);
    }
  }
  flush();

  const chunks: string[] = [];

  for (const { label, body } of sections) {
    const prefix = label ? `${label}\n\n` : "";
    const budget = Math.max(200, maxChars - prefix.length);

    const paragraphs = body
      .split(/\n\s*\n/)
      .map((p) => p.trim())
      .filter(Boolean);

    let current = "";
    const push = (c: string) => chunks.push(prefix + c);

    for (const p of paragraphs) {
      // príliš dlhý odsek: uložíme rozrobený chunk a odsek rozsekáme po znakoch
      if (p.length > budget) {
        if (current) {
          push(current);
          current = "";
        }
        for (let i = 0; i < p.length; i += budget) push(p.slice(i, i + budget));
        continue;
      }

      if (current && current.length + p.length + 2 > budget) {
        push(current);
        current = p;
      } else {
        current = current ? current + "\n\n" + p : p;
      }
    }
    if (current) push(current);
  }

  return chunks;
}
