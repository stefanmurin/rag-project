import { readFile } from "node:fs/promises";
import { basename } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { documents, chunks } from "./db/schema";
import { chunkMarkdown } from "./chunker";
import { embed } from "./embed";

const path = process.argv[2];
if (!path) {
  console.error("Použitie: bun run src/ingest.ts <subor.md>");
  process.exit(1);
}

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const text = await readFile(path, "utf8");
const parts = chunkMarkdown(text);
console.log(`Chunkov: ${parts.length}`);

// embeddingy po dávkach, nech nevolíme Ollamu s tisíckou textov naraz
const BATCH = 16;
const vectors: number[][] = [];
for (let i = 0; i < parts.length; i += BATCH) {
  vectors.push(...(await embed(parts.slice(i, i + BATCH))));
}

// dokument aj chunky v jednej transakcii: buď sa uloží všetko, alebo nič
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
