import { cosineDistance, desc, eq, sql } from "drizzle-orm";
import { db, client } from "./db";
import { chunks, documents } from "./db/schema";
import { embed } from "./embed";

// Nahradiť rizikové to_tsquery stabilným websearch_to_tsquery
export async function searchFullText(query: string, limit = 5) {
  // 1. Odstránime otázniky a iné operátory, ktoré vadia Postgresu
  const cleanQuery = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();

  // Ak po očistení neostalo žiadne slovo, vrátime prázdne pole
  if (!cleanQuery) return [];

  const tsquery = sql`websearch_to_tsquery('english', ${cleanQuery})`;
  const rank = sql<number>`ts_rank_cd(${chunks.contentTsv}, ${tsquery})`;

  return db
    .select({
      id: chunks.id,
      title: documents.title,
      content: chunks.content,
      rank,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .where(sql`${chunks.contentTsv} @@ ${tsquery}`)
    .orderBy(desc(rank))
    .limit(limit);
}

// Oprava typov pri queryVector
export async function searchVector(query: string, limit = 5) {
  const vectors = await embed([query]);
  const queryVector = vectors[0];
  if (!queryVector) throw new Error("Chyba pri generovaní embeddingu.");

  const distance = cosineDistance(chunks.embedding, queryVector);

  return db
    .select({
      id: chunks.id,
      title: documents.title,
      content: chunks.content,
      distance,
    })
    .from(chunks)
    .innerJoin(documents, eq(chunks.documentId, documents.id))
    .orderBy(distance)
    .limit(limit);
}

export async function searchHybrid(
  query: string,
  limit = 5,
  k = 60,
  ftsWeight = Number(process.env.FTS_WEIGHT ?? 0.5),
) {
  const [vec, fts] = await Promise.all([
    searchVector(query, 20),
    searchFullText(query, 20),
  ]);

  const merged = new Map<
    number,
    { id: number; title: string; content: string; score: number }
  >();
  const add = (
    rows: { id: number; title: string; content: string }[],
    weight: number,
  ) => {
    rows.forEach((r, i) => {
      const prev = merged.get(r.id);
      merged.set(r.id, {
        id: r.id,
        title: r.title,
        content: r.content,
        score: (prev?.score ?? 0) + weight / (k + i + 1),
      });
    });
  };
  add(vec, 1);
  add(fts, ftsWeight);

  return {
    results: [...merged.values()]
      .sort((a, b) => b.score - a.score)
      .slice(0, limit),
    bestVectorDistance: vec[0] ? Number(vec[0].distance) : null,
  };
}

// použitie: bun run src/search.ts [vector|fts|hybrid] "otázka"
if (import.meta.main) {
  const args = process.argv.slice(2);
  const modes = ["vector", "fts", "hybrid"];
  const mode = modes.includes(args[0]) ? args.shift()! : "vector";
  const query = args.join(" ");
  if (!query) {
    console.error(
      'Použitie: bun run src/search.ts [vector|fts|hybrid] "otázka"',
    );
    process.exit(1);
  }

  if (mode === "fts") {
    const results = await searchFullText(query);
    if (results.length === 0) console.log("Žiadne zhody.");
    for (const r of results) {
      console.log(
        `\n[${r.id}] ${r.title}  (skóre: ${Number(r.rank).toFixed(3)})`,
      );
      console.log(r.content.slice(0, 200));
    }
  } else if (mode === "hybrid") {
    const { results, bestVectorDistance } = await searchHybrid(query);
    console.log(
      `Najlepšia vektorová vzdialenosť: ${bestVectorDistance?.toFixed(3)}`,
    );
    for (const r of results) {
      console.log(`\n[${r.id}] ${r.title}  (RRF: ${r.score.toFixed(4)})`);
      console.log(r.content.slice(0, 200));
    }
  } else {
    const results = await searchVector(query);
    for (const r of results) {
      console.log(
        `\n[${r.id}] ${r.title}  (vzdialenosť: ${Number(r.distance).toFixed(3)})`,
      );
      console.log(r.content.slice(0, 200));
    }
  }
  await client.end();
}
