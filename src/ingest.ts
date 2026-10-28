import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { extractText } from "unpdf";

import { db, client } from "./db";
import { documents, chunks } from "./db/schema";
import { chunkMarkdown, chunkText } from "./chunker";
import { embed } from "./embed";

export async function ingestDocument(title: string, rawContent: string) {
  const parts = title.toLowerCase().endsWith(".md")
    ? chunkMarkdown(rawContent)
    : chunkText(rawContent);

  if (parts.length === 0) {
    throw new Error("Document contains no text to store.");
  }

  const BATCH = 16;
  const vectors: number[][] = [];
  for (let i = 0; i < parts.length; i += BATCH) {
    vectors.push(...(await embed(parts.slice(i, i + BATCH))));
  }

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

if (import.meta.main) {
  const path = process.argv[2];
  if (!path) {
    console.error("Usage: bun run src/ingest.ts <file.md | file.pdf | file.txt>");
    process.exit(1);
  }

  const ext = extname(path).toLowerCase();
  if (ext !== ".md" && ext !== ".pdf" && ext !== ".txt") {
    console.error("Supported formats: .md, .pdf, .txt");
    process.exit(1);
  }

  let textContent = "";

  if (ext === ".pdf") {
    console.log(`Parsing PDF: ${basename(path)}...`);
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

  console.log(`Ingesting ${basename(path)}...`);
  const res = await ingestDocument(basename(path), textContent);
  console.log(`Done! Stored ${res.chunksCount} chunks.`);

  await client.end();
  process.exit(0);
}
