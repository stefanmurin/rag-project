// Číta odpoveď, v ktorej každý riadok je samostatný JSON (formát, v akom streamuje Ollama).
// Rieši to, že riadok (alebo aj viacbajtový znak) môže prísť rozdelený medzi dva kúsky dát.
export async function* readNdjson<T>(res: Response): AsyncGenerator<T> {
  if (!res.body) throw new Error("Response has no body");

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let nl: number;
      while ((nl = buffer.indexOf("\n")) !== -1) {
        const line = buffer.slice(0, nl).trim();
        buffer = buffer.slice(nl + 1);
        if (line) yield JSON.parse(line) as T;
      }
    }

    buffer += decoder.decode();
    const rest = buffer.trim();
    if (rest) yield JSON.parse(rest) as T;
  } finally {
    reader.releaseLock();
  }
}
