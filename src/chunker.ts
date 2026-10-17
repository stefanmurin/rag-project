export function chunkMarkdown(text: string, maxChars = 800): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
    // príliš dlhý odsek: najprv uložíme rozrobený chunk a potom ho rozsekáme
    if (p.length > maxChars) {
      if (current) {
        chunks.push(current);
        current = "";
      }
      for (let i = 0; i < p.length; i += maxChars) {
        chunks.push(p.slice(i, i + maxChars));
      }
      continue;
    }

    if (current && current.length + p.length + 2 > maxChars) {
      chunks.push(current);
      current = p;
    } else {
      current = current ? current + "\n\n" + p : p;
    }
  }
  if (current) chunks.push(current);

  return chunks;
}
