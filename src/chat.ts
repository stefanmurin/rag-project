import { client } from "./db";
import { searchHybrid } from "./search";
import { readNdjson } from "./ndjson";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const CHAT_MODEL = process.env.CHAT_MODEL ?? "llama3.2";
// skip LLM entirely if the best chunk is farther than this cosine distance
const MAX_DISTANCE = Number(process.env.MAX_DISTANCE ?? 0.55);
// number of chunks passed to the prompt
const TOP_K = Number(process.env.TOP_K ?? 3);
export const NOT_FOUND = "I could not find this in the documents.";

export type Source = { n: number; id: number; title: string; content: string };
export type Citation = {
  n: number;
  chunkId: number;
  title: string;
  content: string;
};
export type DoneEvent = {
  type: "done";
  answer: string;
  citations: Citation[];
  skippedLlm: boolean;
  bestVectorDistance: number | null;
};
export type StreamEvent = { type: "token"; text: string } | DoneEvent;

export const toCitation = (s: Source): Citation => ({
  n: s.n,
  chunkId: s.id,
  title: s.title,
  content: s.content,
});

function buildPrompt(question: string, sources: Source[]) {
  const context = sources
    .map((s) => `[${s.n}] (${s.title})\n${s.content}`)
    .join("\n\n");

  const system = [
    "You answer questions using ONLY the numbered sources provided by the user.",
    "Cite the sources you use as [1], [2] directly after the sentence they support.",
    "Every sentence of your answer must end with a citation.",
    "Do not add any sentence that is not directly supported by a source. Do not generalize or add extra information.",
    `If the sources do not contain the answer, reply exactly: "${NOT_FOUND}"`,
    "Do not use outside knowledge. Answer in one to three sentences.",
  ].join("\n");

  const user = `Sources:\n\n${context}\n\nQuestion: ${question}`;
  return { system, user };
}

async function retrieve(question: string) {
  const { results, bestVectorDistance } = await searchHybrid(question, TOP_K);

  if (
    results.length === 0 ||
    bestVectorDistance === null ||
    bestVectorDistance > MAX_DISTANCE
  ) {
    return {
      skipped: true as const,
      bestVectorDistance,
      sources: [] as Source[],
    };
  }

  const sources: Source[] = results.map((r, i) => ({
    n: i + 1,
    id: r.id,
    title: r.title,
    content: r.content,
  }));
  return { skipped: false as const, bestVectorDistance, sources };
}

function ollamaChat(
  system: string,
  user: string,
  stream: boolean,
  signal?: AbortSignal,
) {
  return fetch(`${OLLAMA_URL}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: CHAT_MODEL,
      stream,
      keep_alive: "5m",
      options: { temperature: 0 },
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal,
  });
}

function citedFrom(text: string, sources: Source[]): Source[] {
  const nums = new Set(
    [...text.matchAll(/\[(\d+)\]/g)].map((m) => Number(m[1])),
  );
  return sources.filter((s) => nums.has(s.n));
}

export async function* answerStream(
  question: string,
  signal?: AbortSignal,
): AsyncGenerator<StreamEvent> {
  const r = await retrieve(question);

  if (r.skipped) {
    yield {
      type: "done",
      answer: NOT_FOUND,
      citations: [],
      skippedLlm: true,
      bestVectorDistance: r.bestVectorDistance,
    };
    return;
  }

  const { system, user } = buildPrompt(question, r.sources);
  const res = await ollamaChat(system, user, true, signal);
  if (!res.ok)
    throw new Error(`Ollama chat error ${res.status}: ${await res.text()}`);

  let full = "";
  for await (const chunk of readNdjson<{
    message?: { content?: string };
    error?: string;
  }>(res)) {
    if (chunk.error) throw new Error(chunk.error);
    const text = chunk.message?.content ?? "";
    if (text) {
      full += text;
      yield { type: "token", text };
    }
  }

  const final = full.trim();
  yield {
    type: "done",
    answer: final,
    citations: citedFrom(final, r.sources).map(toCitation),
    skippedLlm: false,
    bestVectorDistance: r.bestVectorDistance,
  };
}

// Usage: bun run src/chat.ts "question"
if (import.meta.main) {
  const question = process.argv.slice(2).join(" ");
  if (!question) {
    console.error('Usage: bun run src/chat.ts "question"');
    process.exit(1);
  }

  const t0 = Date.now();
  let firstTokenMs: number | null = null;
  let done: DoneEvent | null = null;

  process.stdout.write("\n");
  for await (const ev of answerStream(question)) {
    if (ev.type === "token") {
      if (firstTokenMs === null) firstTokenMs = Date.now() - t0;
      process.stdout.write(ev.text);
    } else {
      done = ev;
    }
  }
  console.log("\n");

  if (done?.skippedLlm) {
    console.log(
      `(LLM skipped — best distance ${done.bestVectorDistance?.toFixed(3)} > threshold ${MAX_DISTANCE})`,
    );
  } else if (done && done.citations.length === 0 && done.answer !== NOT_FOUND) {
    console.log("(warning: model cited no sources)");
  }

  if (done && done.citations.length > 0) {
    console.log("Sources:");
    for (const c of done.citations) {
      console.log(
        `  [${c.n}] ${c.title} (chunk ${c.chunkId}): ${c.content.slice(0, 120).replace(/\s+/g, " ")}...`,
      );
    }
  }

  const total = ((Date.now() - t0) / 1000).toFixed(1);
  const first = firstTokenMs === null ? "-" : (firstTokenMs / 1000).toFixed(1);
  console.log(`\nFirst token: ${first}s  total: ${total}s`);
  await client.end();
}
