# RAG Project

A fully local Retrieval-Augmented Generation (RAG) system. Upload your own Markdown, plain-text, or PDF documents, ask questions in natural language, and get answers with inline citations — all running on your machine with no external API calls.

## How it works

```
question
  └─► embed (Ollama)
        └─► hybrid search: vector (pgvector HNSW) + full-text (PostgreSQL FTS)
                            └─► Reciprocal Rank Fusion (RRF)
                                  └─► distance threshold (MAX_DISTANCE)
                                        ├─► above threshold → "I could not find this in the documents."
                                        └─► below threshold → LLM (Ollama) with numbered sources
                                                └─► answer with inline citations [1], [2], ...
```

## Stack

| Layer | Technology |
|---|---|
| Runtime & backend | [Bun](https://bun.sh) |
| Database | PostgreSQL 16 + [pgvector](https://github.com/pgvector/pgvector) (Docker) |
| ORM | [Drizzle ORM](https://orm.drizzle.team) |
| Embeddings | Ollama — `nomic-embed-text` (768 dimensions) |
| Chat model | Ollama — `llama3.2` (3B, ~2 GB) |
| Frontend | React 19 + Tailwind CSS (Vite) |

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/)
- [Bun](https://bun.sh) v1.0+
- [Ollama](https://ollama.com) with the two required models:

```bash
ollama pull nomic-embed-text
ollama pull llama3.2
```

## Quick start

```bash
# 1. Clone and install dependencies
git clone <repo-url>
cd rag-project
bun install
cd frontend && bun install && cd ..

# 2. Configure environment
cp .env.example .env

# 3. Start the database
docker compose up -d

# 4. Push the schema to the database
bunx drizzle-kit push

# 5. Start the backend
bun run src/server.ts

# 6. Start the frontend (separate terminal)
cd frontend && bun run dev
```

The backend runs on `http://localhost:3000`, the frontend on `http://localhost:5173`.

## Ingesting documents

**Via CLI** (Markdown, plain text, or PDF):

```bash
bun run src/ingest.ts docs/internal-policy.md
bun run src/ingest.ts docs/docker-guide.md
```

**Via API** (plain text or Markdown content):

```bash
curl -X POST http://localhost:3000/api/ingest \
  -H "Content-Type: application/json" \
  -d '{"title": "my-doc.md", "content": "# My Document\n\nSome content..."}'
```

The `docs/` folder contains sample documents you can ingest right away to test the system.

## API endpoints

| Method | Path | Description |
|---|---|---|
| `POST` | `/api/ingest` | Index a document `{ title, content }` |
| `POST` | `/chat/stream` | Ask a question `{ question }` — returns SSE stream |
| `POST` | `/api/reset` | Delete all documents and chunks |

The `/chat/stream` endpoint emits Server-Sent Events:
- `{ type: "token", text: "..." }` — streamed answer tokens
- `{ type: "done", answer, citations, skippedLlm, bestVectorDistance }` — final event with citations

## Evaluation

The `eval/` folder contains a retrieval benchmark: 20 paraphrase questions and 4 out-of-corpus questions against the sample documents.

```bash
# Run against questions.json (default)
bun run src/eval.ts

# Run against keywords.json
bun run src/eval.ts eval/keywords.json

# Tune FTS weight
FTS_WEIGHT=1.0 bun run src/eval.ts
```

**Results on sample corpus (~24 chunks):**

| Question set | Method | top-1 | top-5 | MRR |
|---|---|---|---|---|
| paraphrases (n=20) | vector | 17/20 | 20/20 | 0.917 |
| paraphrases (n=20) | full-text | 9/20 | 17/20 | 0.627 |
| paraphrases (n=20) | hybrid (fts weight 0.5) | 16/20 | 20/20 | 0.892 |
| exact keywords (n=10) | vector | 9/10 | 10/10 | 0.920 |
| exact keywords (n=10) | full-text | 9/10 | 10/10 | 0.933 |
| exact keywords (n=10) | hybrid (fts weight 0.5) | 10/10 | 10/10 | 1.000 |

Takeaway: hybrid search is more robust — vector wins on paraphrases, full-text wins on exact terms, and hybrid covers both.

> The sample documents and evaluation questions are **synthetic** (AI-generated for demo purposes).

## Project structure

```
src/
  server.ts      — Bun HTTP server (CORS, SSE, ingest endpoint)
  chat.ts        — retrieve + prompt + stream answer with citations
  search.ts      — searchVector, searchFullText, searchHybrid (RRF)
  ingest.ts      — chunk → embed → store in PostgreSQL
  chunker.ts     — Markdown-aware and plain-text chunkers
  embed.ts       — Ollama embedding API wrapper
  ndjson.ts      — NDJSON stream reader for Ollama responses
  eval.ts        — retrieval evaluation (top-1, top-5, MRR)
  db/
    index.ts     — Drizzle + postgres-js client
    schema.ts    — documents and chunks tables (HNSW + GIN indexes)
frontend/
  src/
    App.tsx                 — main layout
    components/
      ChatInput.tsx         — question input
      ChatMessage.tsx       — message with citation rendering
      DocumentUpload.tsx    — file/text upload UI
    hooks/
      useChatStream.ts      — SSE stream hook
docs/            — sample documents for demo ingestion
eval/            — benchmark question sets (questions.json, keywords.json)
docker-compose.yml
drizzle.config.ts
```

## Useful commands

```bash
# Search directly (bypass LLM)
bun run src/search.ts hybrid "What is the backup retention policy?"
bun run src/search.ts vector "HNSW index"
bun run src/search.ts fts "container storage"

# Ask a question from the CLI
bun run src/chat.ts "When can I run schema migrations that lock tables?"

# Database management
docker compose up -d / stop / ps / logs db
bunx drizzle-kit push
docker compose exec db psql -U rag -d rag -c "SELECT count(*) FROM chunks;"
```
