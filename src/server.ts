import { Elysia, t } from "elysia";
import { extname } from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { extractText } from "unpdf";

import { answer, answerStream, toCitation } from "./chat";
import { documents, chunks } from "./db/schema";
import { chunkMarkdown, chunkText } from "./chunker";
import { embed } from "./embed";

const PORT = Number(process.env.PORT ?? 3000);

// Spojenie s DB pre upload
const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client);

const questionBody = t.Object({
  question: t.String({ minLength: 1, maxLength: 500 }),
});

// jednoduché UI: jedna HTML stránka z priečinka public/
const indexHtml = Bun.file(new URL("../public/index.html", import.meta.url));

const app = new Elysia()
  .get(
    "/",
    () => new Response(indexHtml, { headers: { "Content-Type": "text/html; charset=utf-8" } }),
  )
  .get("/health", () => ({ ok: true }))

  // Upload endpoint pre .md a .pdf súbory
  .post(
    "/upload",
    async ({ body, set }) => {
      const file = body.file;
      const filename = file.name;
      const ext = extname(filename).toLowerCase();

      if (ext !== ".md" && ext !== ".pdf" && ext !== ".txt") {
        set.status = 400;
        return { error: "Supported file formats are only .md, .pdf and .txt." };
      }

      let parts: string[] = [];

      try {
        if (ext === ".pdf") {
          const buffer = await file.arrayBuffer();
          const { text } = await extractText(new Uint8Array(buffer));
          const fullText = Array.isArray(text) ? text.join("\n\n") : text;
          const cleanedText = fullText
            .replace(/\r\n/g, "\n")
            .replace(/\n{3,}/g, "\n\n")
            .trim();
          parts = chunkText(cleanedText);
        } else {
          const text = await file.text();
          parts = ext === ".md" ? chunkMarkdown(text) : chunkText(text);
        }

        if (parts.length === 0) {
          set.status = 400;
          return { error: "File contains no readable text." };
        }

        // Generovanie embeddingov po dávkach
        const BATCH = 16;
        const vectors: number[][] = [];
        for (let i = 0; i < parts.length; i += BATCH) {
          vectors.push(...(await embed(parts.slice(i, i + BATCH))));
        }

        // Uloženie dokumentu a chunkov v transakcii
        const docId = await db.transaction(async (tx) => {
          const [doc] = await tx
            .insert(documents)
            .values({ title: filename })
            .returning();

          await tx.insert(chunks).values(
            parts.map((content, i) => ({
              documentId: doc.id,
              position: i,
              content,
              embedding: vectors[i],
            })),
          );

          return doc.id;
        });

        return {
          ok: true,
          documentId: docId,
          title: filename,
          chunksCount: parts.length,
        };
      } catch (err) {
        set.status = 500;
        return { error: err instanceof Error ? err.message : "Failed to process file." };
      }
    },
    {
      body: t.Object({
        file: t.File(),
      }),
    },
  )

  // odpoveď naraz
  .post(
    "/chat",
    async ({ body }) => {
      const r = await answer(body.question);
      return {
        answer: r.answer,
        citations: r.cited.map(toCitation),
        skippedLlm: r.skippedLlm,
        bestVectorDistance: r.bestVectorDistance,
      };
    },
    { body: questionBody },
  )

  // odpoveď po kúskoch (Server-Sent Events)
  .post(
    "/chat/stream",
    ({ body }) => {
      const encoder = new TextEncoder();
      const abort = new AbortController();
      let closed = false;

      const stream = new ReadableStream({
        async start(controller) {
          const send = (event: unknown) => {
            if (closed) return;
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
          };

          try {
            for await (const ev of answerStream(body.question, abort.signal)) send(ev);
          } catch (e) {
            if (!abort.signal.aborted) {
              send({ type: "error", message: e instanceof Error ? e.message : String(e) });
            }
          } finally {
            if (!closed) {
              closed = true;
              controller.close();
            }
          }
        },
        cancel() {
          closed = true;
          abort.abort();
        },
      });

      return new Response(stream, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        },
      });
    },
    { body: questionBody },
  )
  .listen(PORT);

console.log(`Server beží na http://localhost:${app.server?.port}`);
