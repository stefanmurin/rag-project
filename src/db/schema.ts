import { sql } from "drizzle-orm";
import {
  pgTable,
  serial,
  text,
  integer,
  timestamp,
  vector,
  index,
  customType,
} from "drizzle-orm/pg-core";

// Drizzle nemá vstavaný typ tsvector, preto si ho definujeme sami
const tsvector = customType<{ data: string }>({
  dataType() {
    return "tsvector";
  },
});

export const documents = pgTable("documents", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const chunks = pgTable(
  "chunks",
  {
    id: serial("id").primaryKey(),
    documentId: integer("document_id")
      .references(() => documents.id, { onDelete: "cascade" })
      .notNull(),
    position: integer("position").notNull(),
    content: text("content").notNull(),
    embedding: vector("embedding", { dimensions: 768 }).notNull(),
    // generovaný stĺpec: Postgres ho vypočíta sám z content, pri vkladaní ho nezadávame
    contentTsv: tsvector("content_tsv").generatedAlwaysAs(
      sql`to_tsvector('english', content)`,
    ),
  },
  (t) => [
    index("chunks_embedding_idx").using("hnsw", t.embedding.op("vector_cosine_ops")),
    index("chunks_content_tsv_idx").using("gin", t.contentTsv),
  ],
);
