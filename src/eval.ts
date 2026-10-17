import { readFile } from "node:fs/promises";
import { client } from "./db";
import { searchVector, searchFullText, searchHybrid } from "./search";

type Q = { question: string; expected?: string[] };

const file = process.argv[2] ?? "eval/questions.json";
const questions: Q[] = JSON.parse(await readFile(file, "utf8"));

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ");
const isHit = (content: string, expected: string[]) =>
  expected.some((e) => norm(content).includes(norm(e)));

// poradie prvého správneho chunku (1 = prvý), alebo null ak v top 5 nie je
function rankOf(rows: { content: string }[], expected: string[]): number | null {
  const i = rows.findIndex((r) => isHit(r.content, expected));
  return i === -1 ? null : i + 1;
}

type Stats = { top1: number; top5: number; rrSum: number };
const stats: Record<string, Stats> = {
  vector: { top1: 0, top5: 0, rrSum: 0 },
  fts: { top1: 0, top5: 0, rrSum: 0 },
  hybrid: { top1: 0, top5: 0, rrSum: 0 },
};

function record(method: string, rank: number | null) {
  const s = stats[method];
  if (rank === 1) s.top1++;
  if (rank !== null) {
    s.top5++;
    s.rrSum += 1 / rank;
  }
}

const inCorpus = questions.filter((q) => q.expected);
const outOfCorpus = questions.filter((q) => !q.expected);

console.log("\n=== OTÁZKY Z DOKUMENTOV (poradie správneho chunku, '-' = nie je v top 5) ===\n");
console.log("vec  fts  hyb  otázka");

const hitDistances: number[] = [];

for (const q of inCorpus) {
  const vec = await searchVector(q.question, 5);
  const fts = await searchFullText(q.question, 5);
  const { results: hyb } = await searchHybrid(q.question, 5);

  const rv = rankOf(vec, q.expected!);
  const rf = rankOf(fts, q.expected!);
  const rh = rankOf(hyb, q.expected!);

  record("vector", rv);
  record("fts", rf);
  record("hybrid", rh);

  if (rv !== null) hitDistances.push(Number(vec[rv - 1].distance));

  const f = (r: number | null) => String(r ?? "-").padEnd(4);
  console.log(`${f(rv)} ${f(rf)} ${f(rh)} ${q.question}`);
}

const n = inCorpus.length;
console.log("\n=== SÚHRN ===\n");
console.log("metóda   top-1        top-5        MRR");
for (const [method, s] of Object.entries(stats)) {
  console.log(
    `${method.padEnd(8)} ${`${s.top1}/${n}`.padEnd(12)} ${`${s.top5}/${n}`.padEnd(12)} ${(s.rrSum / n).toFixed(3)}`,
  );
}

console.log("\n=== OTÁZKY MIMO DOKUMENTOV (nemali by nič nájsť) ===\n");
console.log("najlepšia vzdialenosť  fts zhody  najlepšie RRF  otázka");

const outDistances: number[] = [];
for (const q of outOfCorpus) {
  const { results, bestVectorDistance } = await searchHybrid(q.question, 5);
  const fts = await searchFullText(q.question, 5);
  if (bestVectorDistance !== null) outDistances.push(bestVectorDistance);
  console.log(
    `${(bestVectorDistance ?? NaN).toFixed(3).padEnd(22)} ${String(fts.length).padEnd(10)} ${(results[0]?.score ?? 0).toFixed(4).padEnd(14)} ${q.question}`,
  );
}

if (hitDistances.length && outDistances.length) {
  const maxHit = Math.max(...hitDistances);
  const minOut = Math.min(...outDistances);
  console.log("\n=== PRAH PRE 'NENAŠIEL SOM' ===\n");
  console.log(`Najväčšia vzdialenosť správneho chunku (z dokumentov): ${maxHit.toFixed(3)}`);
  console.log(`Najmenšia najlepšia vzdialenosť (mimo dokumentov):     ${minOut.toFixed(3)}`);
  console.log(
    maxHit < minOut
      ? `Prah medzi ${maxHit.toFixed(3)} a ${minOut.toFixed(3)} ich čisto oddelí.`
      : "Rozsahy sa prekrývajú, jednoduchý prah na vzdialenosť ich nerozlíši.",
  );
}

await client.end();
