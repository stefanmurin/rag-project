// src/server.ts
import { answerStream } from "./chat";
import { ingestDocument } from "./ingest";
import { db } from "./db";
import { documents } from "./db/schema";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

Bun.serve({
  port: 3000,
  idleTimeout: 255,
  async fetch(req) {
    const url = new URL(req.url);
    console.log(
      `[POŽIADAVKA] Metóda: ${req.method} | Cesta: "${url.pathname}"`,
    );
    // 1. Riešenie CORS Preflight požiadaviek z prehliadača
    if (req.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (url.pathname === "/api/reset" && req.method === "POST") {
      try {
        // Vďaka cascade zmaže aj všetky naviazané chunky
        await db.delete(documents);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Databáza bola vyčistená.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (err) {
        console.error("Chyba pri resetovaní DB:", err);
        return new Response(JSON.stringify({ error: "Reset zlyhal." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // 2. Chat SSE Stream pre React frontend
    if (url.pathname === "/chat/stream" && req.method === "POST") {
      try {
        const body = (await req.json()) as { question?: string };
        const question = body.question?.trim();

        if (!question) {
          return new Response(
            JSON.stringify({ error: "Pole 'question' je povinné." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
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
              controller.close(); // Iba pri úspešnom dobehnutí!
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
        console.error("Chyba v /chat/stream:", err);
        return new Response(
          JSON.stringify({ error: "Interná chyba servera." }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // 3. Endpoint na nahrávanie a indexovanie dokumentov
    if (url.pathname === "/api/ingest" && req.method === "POST") {
      try {
        const body = (await req.json()) as { title?: string; content?: string };
        const title = body.title?.trim();
        const content = body.content?.trim();

        if (!title || !content) {
          return new Response(
            JSON.stringify({ error: "Názov aj obsah dokumentu sú povinné." }),
            {
              status: 400,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            },
          );
        }

        // Zavolá ingest logiku (chunker -> embedding -> postgres)
        await ingestDocument(title, content);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Dokument bol úspešne uložený.",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      } catch (err) {
        console.error("Chyba v /api/ingest:", err);
        return new Response(
          JSON.stringify({
            error: "Chyba pri ukladaní a indexovaní dokumentu.",
          }),
          {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    // Všetko ostatné vráti 404
    return new Response(JSON.stringify({ error: "Routa neexistuje." }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  },
});

console.log("🚀 RAG Backend beží na http://localhost:3000");
