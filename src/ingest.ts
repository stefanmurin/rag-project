import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { extractText } from "unpdf";

import { documents, chunks } from "./db/schema";
import { chunkMarkdown, chunkText } from "./chunker";
import { embed } from "./embed";


const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

/**
 * Funkcia volaná zo server.ts (napr. z React frontendu)
 */
export async function ingestDocument(title: string, rawContent: string) {
  // Ak názov končí na .md, použije markdown chunker, inak textový
  const parts = title.toLowerCase().endsWith(".md")
    ? chunkMarkdown(rawContent)
    : chunkText(rawContent);

  if (parts.length === 0) {
    throw new Error("Dokument neobsahuje žiadny text na uloženie.");
  }

  // Generovanie embeddingov po dávkach
  const BATCH = 16;
  const vectors: number[][] = [];
  for (let i = 0; i < parts.length; i += BATCH) {
    vectors.push(...(await embed(parts.slice(i, i + BATCH))));
  }

  // Uloženie dokumentu a chunkov v jednej transakcii
  await db.transaction(async (tx) => {
    const [doc] = await tx.insert(documents).values({ title }).returning();

    await tx.insert(chunks).values(
      parts.map((content, i) => ({
        documentId: doc.id,
        position: i,
        content,
        embedding: vectors[i],
      })),
    );
  });

  return { success: true, chunksCount: parts.length };
}

// -------------------------------------------------------------
// CLI režim: spustí sa iba vtedy, ak bol súbor spustený priamo
// bun run src/ingest.ts <subor>
// -------------------------------------------------------------
if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error(
      "Použitie: bun run src/ingest.ts <subor.md | subor.pdf | subor.txt>",
    );
    process.exit(1);
  }

  const ext = extname(path).toLowerCase();
  if (ext !== ".md" && ext !== ".pdf" && ext !== ".txt") {
    console.error("Podporované formáty sú iba .md, .pdf a .txt");
    process.exit(1);
  }

  let textContent = "";

  if (ext === ".pdf") {
    console.log(`Parsujem PDF súbor: ${basename(path)}...`);
    const buffer = await readFile(path);
    const { text } = await extractText(new Uint8Array(buffer));
    const fullText = Array.isArray(text) ? text.join("\n\n") : text;
    textContent = fullText
      .replace(/\r\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .trim();
  } else {
    textContent = await readFile(path, "utf8");
  }

  console.log(`Ingestujem ${basename(path)}...`);
  const res = await ingestDocument(basename(path), textContent);
  console.log(`Hotovo! Uložených ${res.chunksCount} chunkov do DB.`);

  await client.end();
  process.exit(0);
}
