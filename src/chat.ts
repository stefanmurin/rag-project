import { client } from "./db";
import { searchHybrid } from "./search";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const CHAT_MODEL = process.env.CHAT_MODEL ?? "llama3.2";
// ak je najlepší chunk ďalej než táto vzdialenosť, LLM vôbec nevoláme
const MAX_DISTANCE = Number(process.env.MAX_DISTANCE ?? 0.55);
const NOT_FOUND = "I could not find this in the documents.";

type Source = { n: number; id: number; title: string; content: string };

function buildPrompt(question: string, sources: Source[]) {
  const context = sources
    .map((s) => `[${s.n}] (${s.title})\n${s.content}`)
    .join("\n\n");

  const system = [
    "You answer questions using ONLY the numbered sources provided by the user.",
    "Cite the sources you use as [1], [2] directly after the sentence they support.",
    `If the sources do not contain the answer, reply exactly: "${NOT_FOUND}"`,
    "Do not use outside knowledge. Be concise.",
  ].join("\n");

  const user = `Sources:\n\n${context}\n\nQuestion: ${question}`;
  return { system, user };
}

export async function answer(question: string) {
  const { results, bestVectorDistance } = await searchHybrid(question, 5);

  // 1. lacný filter: nič dosť blízko, nevoláme LLM
  if (results.length === 0 || bestVectorDistance === null || bestVectorDistance > MAX_DISTANCE) {
    return {
      answer: NOT_FOUND,
      cited: [] as Source[],
      sources: [] as Source[],
      skippedLlm: true,
      bestVectorDistance,
    };
  }

  const sources: Source[] = results.map((r, i) => ({
    n: i + 1,
    id: r.id,
    title: r.title,
    content: r.content,
  }));

  // 2. generovanie odpovede z očíslovaných úryvkov
  const { system, user } = buildPrompt(question, sources);
  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream: false,
      keep_alive: "2m", // model sa po 2 minútach nečinnosti uvoľní z RAM
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) {
    throw new Error(`Ollama chat error ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { message: { content: string } };
  const text = data.message.content.trim();

  // 3. ktoré zdroje model skutočne citoval (ignorujeme neexistujúce čísla)
  const citedNumbers = new Set(
    [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  const cited = sources.filter((s) => citedNumbers.has(s.n));

  return { answer: text, cited, sources, skippedLlm: false, bestVectorDistance };
}

// použitie: bun run src/chat.ts "otázka"
if (import.meta.main) {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error('Použitie: bun run src/chat.ts "otázka"');
    process.exit(1);
  }

  const t0 = Date.now();
  const r = await answer(question);
  const seconds = ((Date.now() - t0) / 1000).toFixed(1);

  console.log(`\n${r.answer}\n`);

  if (r.skippedLlm) {
    console.log(
      `(LLM sa nevolal, najlepšia vzdialenosť ${r.bestVectorDistance?.toFixed(3)} > prah ${MAX_DISTANCE})`,
    );
  } else if (r.cited.length === 0 && r.answer !== NOT_FOUND) {
    console.log("(pozor: model necitoval žiadny zdroj)");
  }

  if (r.cited.length > 0) {
    console.log("Zdroje:");
    for (const s of r.cited) {
      console.log(`  [${s.n}] ${s.title} (chunk ${s.id}): ${s.content.slice(0, 120).replace(/\s+/g, " ")}...`);
    }
  }
  console.log(`\nČas: ${seconds} s`);
  await client.end();
}
