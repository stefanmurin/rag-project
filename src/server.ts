import { Elysia, t } from "elysia";
import { answer } from "./chat";

const PORT = Number(process.env.PORT ?? 3000);

const app = new Elysia()
  .get("/health", () => ({ ok: true }))
  .post(
    "/chat",
    async ({ body }) => {
      const r = await answer(body.question);
      return {
        answer: r.answer,
        // len zdroje, ktoré model skutočne citoval
        citations: r.cited.map((s) => ({
          n: s.n,
          chunkId: s.id,
          title: s.title,
          content: s.content,
        })),
        skippedLlm: r.skippedLlm,
        bestVectorDistance: r.bestVectorDistance,
      };
    },
    {
      body: t.Object({
        question: t.String({ minLength: 1, maxLength: 500 }),
      }),
    },
  )
  .listen(PORT);

console.log(`Server beží na http://localhost:${app.server?.port}`);
