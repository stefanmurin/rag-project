import { Elysia, t } from "elysia";
import { answer, answerStream, toCitation } from "./chat";

const PORT = Number(process.env.PORT ?? 3000);

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

  // odpoveď naraz
  .post(
    "/chat",
    async ({ body }) => {
      const r = await answer(body.question);
      return {
        answer: r.answer,
        // len zdroje, ktoré model skutočne citoval
        citations: r.cited.map(toCitation),
        skippedLlm: r.skippedLlm,
        bestVectorDistance: r.bestVectorDistance,
      };
    },
    { body: questionBody },
  )

  // odpoveď po kúskoch (Server-Sent Events): riadky "data: {...}"
  // udalosti: {type:"token", text}, {type:"done", answer, citations, ...}, {type:"error", message}
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
        // klient sa odpojil: prestaneme generovať a zrušíme volanie Ollamy
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
