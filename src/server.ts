import { count, desc, eq } from "drizzle-orm";
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

    return new Response(JSON.stringify({ error: "Not found." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
});

console.log("RAG backend running on http://localhost:3000");
