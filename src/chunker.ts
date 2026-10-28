// Splits Markdown into chunks by headings and paragraphs.
// Each chunk is prefixed with its heading path (e.g. "Docker > Storage") so
// the chunk carries context about its section — helps both vector and full-text search.
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

///// 

export function chunkText(text: string, maxChars = 800): string[] {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);

  const chunks: string[] = [];
  let current = "";

  for (const p of paragraphs) {
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
