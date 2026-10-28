import { count, desc, eq } from "drizzle-orm";
import { extractText } from "unpdf";
import { answerStream } from "./chat";
import { ingestDocument } from "./ingest";
import { db } from "./db";
import { chunks, documents } from "./db/schema";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Bun.serve({
  port: 3000,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(`[REQUEST] ${req.method} ${url.pathname}`);

    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/documents" && req.method === "GET") {
      try {
        const docs = await db
          .select({
            id: documents.id,
            title: documents.title,
            createdAt: documents.createdAt,
            chunkCount: count(chunks.id),
          })
          .from(documents)
          .leftJoin(chunks, eq(chunks.documentId, documents.id))
          .groupBy(documents.id)
          .orderBy(desc(documents.createdAt));

        return new Response(JSON.stringify(docs), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("/api/documents error:", err);
        return new Response(JSON.stringify({ error: "Failed to fetch documents." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const deleteMatch = url.pathname.match(/^\/api\/documents\/(\d+)$/);
    if (deleteMatch && req.method === "DELETE") {
      try {
        const id = Number(deleteMatch[1]);
        await db.delete(documents).where(eq(documents.id, id));
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (err) {
        console.error("/api/documents/:id DELETE error:", err);
        return new Response(JSON.stringify({ error: "Failed to delete document." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      try {
        await db.delete(documents);
        return new Response(
          JSON.stringify({ success: true, message: "Database cleared." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        console.error("Reset error:", err);
        return new Response(JSON.stringify({ error: "Reset failed." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (url.pathname === "/chat/stream" && req.method === "POST") {
      try {
        const body = (await req.json()) as { question?: string };
        const question = body.question?.trim();

        if (!question) {
          return new Response(
            JSON.stringify({ error: "Field 'question' is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const stream = new ReadableStream({
          async start(controller) {
            const encoder = new TextEncoder();
            try {
              for await (const chunk of answerStream(question, req.signal)) {
                controller.enqueue(
                  encoder.encode(`data: ${JSON.stringify(chunk)}\n\n`),
                );
              }
              controller.close();
            } catch (err) {
              controller.error(err);
            }
          },
        });

        return new Response(stream, {
          headers: {
            ...corsHeaders,
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          },
        });
      } catch (err) {
        console.error("/chat/stream error:", err);
        return new Response(
          JSON.stringify({ error: "Internal server error." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (url.pathname === "/api/ingest" && req.method === "POST") {
      try {
        const body = (await req.json()) as { title?: string; content?: string };
        const title = body.title?.trim();
        const content = body.content?.trim();

        if (!title || !content) {
          return new Response(
            JSON.stringify({ error: "Both 'title' and 'content' are required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        await ingestDocument(title, content);

        return new Response(
          JSON.stringify({ success: true, message: "Document stored." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        console.error("/api/ingest error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to store and index document." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    if (url.pathname === "/api/ingest/file" && req.method === "POST") {
      try {
        const formData = await req.formData();
        const file = formData.get("file");
        if (!(file instanceof File)) {
          return new Response(
            JSON.stringify({ error: "Field 'file' is required." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        const ext = file.name.split(".").pop()?.toLowerCase();
        if (!["md", "txt", "pdf"].includes(ext ?? "")) {
          return new Response(
            JSON.stringify({ error: "Supported formats: .md, .txt, .pdf" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        let content: string;
        if (ext === "pdf") {
          const buffer = await file.arrayBuffer();
          const { text } = await extractText(new Uint8Array(buffer));
          const raw = Array.isArray(text) ? text.join("\n\n") : text;
          content = raw.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
        } else {
          content = await file.text();
        }

        if (!content) {
          return new Response(
            JSON.stringify({ error: "File appears to be empty." }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }

        await ingestDocument(file.name, content);
        return new Response(
          JSON.stringify({ success: true, message: "Document stored." }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } catch (err) {
        console.error("/api/ingest/file error:", err);
        return new Response(
          JSON.stringify({ error: "Failed to store and index document." }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
    }

    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
});

console.log("RAG backend running on http://localhost:3000");

// Preload both models into RAM in the background so the first real request is fast.
const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://localhost:11434";
const CHAT_MODEL  = process.env.CHAT_MODEL  ?? "llama3.2";
const EMBED_MODEL = process.env.EMBED_MODEL ?? "nomic-embed-text";

async function warmUp() {
  try {
    await Promise.all([
      fetch(`${OLLAMA_URL}/api/embed`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: EMBED_MODEL, input: ["warm-up"] }),
      }),
      fetch(`${OLLAMA_URL}/api/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: CHAT_MODEL,
          stream: false,
          keep_alive: "5m",
          messages: [{ role: "user", content: "hi" }],
        }),
      }),
    ]);
    console.log("Models warmed up.");
  } catch {
    // Ollama not ready yet — first real request will load the models
  }
}

warmUp();
