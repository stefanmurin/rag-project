import { cosineDistance, desc, eq, sql } from "drizzle-orm";
import { db, client } from "./db";
import { chunks, documents } from "./db/schema";
import { embed } from "./embed";

export async function searchFullText(query: string, limit = 5) {
  // websearch_to_tsquery is safer than to_tsquery — handles punctuation without throwing
  const cleanQuery = query.replace(/[^\p{L}\p{N}\s]/gu, " ").trim();

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

export async function searchVector(query: string, limit = 5) {
  const vectors = await embed([query]);
  const queryVector = vectors[0];
  if (!queryVector) throw new Error("Failed to generate embedding.");

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

// Usage: bun run src/search.ts [vector|fts|hybrid] "query"
if (import.meta.main) {
  const args = process.argv.slice(2);
  const modes = ["vector", "fts", "hybrid"];
  const mode = modes.includes(args[0]) ? args.shift()! : "vector";
  const query = args.join(" ");
  if (!query) {
    console.error('Usage: bun run src/search.ts [vector|fts|hybrid] "query"');
    process.exit(1);
  }

  if (mode === "fts") {
    const results = await searchFullText(query);
    if (results.length === 0) console.log("No matches.");
    for (const r of results) {
      console.log(`\n[${r.id}] ${r.title}  (score: ${Number(r.rank).toFixed(3)})`);
      console.log(r.content.slice(0, 200));
    }
  } else if (mode === "hybrid") {
    const { results, bestVectorDistance } = await searchHybrid(query);
    console.log(`Best vector distance: ${bestVectorDistance?.toFixed(3)}`);
    for (const r of results) {
      console.log(`\n[${r.id}] ${r.title}  (RRF: ${r.score.toFixed(4)})`);
      console.log(r.content.slice(0, 200));
    }
  } else {
    const results = await searchVector(query);
    for (const r of results) {
      console.log(`\n[${r.id}] ${r.title}  (distance: ${Number(r.distance).toFixed(3)})`);
      console.log(r.content.slice(0, 200));
    }
  }
  await client.end();
}
