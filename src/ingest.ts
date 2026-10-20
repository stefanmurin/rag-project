import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { extractText } from "unpdf";

import { documents, chunks } from "./db/schema";
import { chunkMarkdown, chunkText } from "./chunker";
import { embed } from "./embed";

const path = process.argv[2];
if (!path) {
  console.error("Použitie: bun run src/ingest.ts <subor.md | subor.pdf>");
  process.exit(1);
}

const ext = extname(path).toLowerCase();
if (ext !== ".md" && ext !== ".pdf" && ext !== ".txt") {
  console.error("Podporované formáty sú iba .md, .pdf a .txt");
  process.exit(1);
}

let parts: string[] = [];

if (ext === ".pdf") {
  console.log(`Parsujem PDF súbor: ${basename(path)}...`);
  const buffer = await readFile(path);
  
  // unpdf pracuje priamo s Uint8Array
  const { text } = await extractText(new Uint8Array(buffer));

  // text môže byť pole strán alebo spojený string
  const fullText = Array.isArray(text) ? text.join("\n\n") : text;

  const cleanedText = fullText
    .replace(/\r\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  parts = chunkText(cleanedText);
} else {
  const text = await readFile(path, "utf8");
  parts = ext === ".md" ? chunkMarkdown(text) : chunkText(text);
}

console.log(`Vytvorených chunkov: ${parts.length}`);

if (parts.length === 0) {
  console.warn("Súbor neobsahuje žiadny text na uloženie.");
  process.exit(0);
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

// embeddingy po dávkach
const BATCH = 16;
const vectors: number[][] = [];
for (let i = 0; i < parts.length; i += BATCH) {
  process.stdout.write(`Generujem embeddingy: ${i}/${parts.length}\r`);
  vectors.push(...(await embed(parts.slice(i, i + BATCH))));
}
console.log(`Generujem embeddingy: ${parts.length}/${parts.length} - hotovo.`);

// dokument aj chunky v jednej transakcii
await db.transaction(async (tx) => {
  const [doc] = await tx
    .insert(documents)
    .values({ title: basename(path) })
    .returning();

  await tx.insert(chunks).values(
    parts.map((content, i) => ({
      documentId: doc.id,
      position: i,
      content,
      embedding: vectors[i],
    })),
  );
});

console.log("Hotovo, uložené do DB.");
await client.end();
