# Database Indexing Strategies: B-Tree, GIN, and HNSW

An index is a data structure that improves the speed of data retrieval operations on a database table at the cost of additional writes and storage space.

## B-Tree Indexes

B-Tree (Balanced Tree) is the default index type in PostgreSQL. It is self-balancing and maintains sorted data, allowing searches, sequential access, insertions, and deletions in logarithmic time: $O(\log n)$.

B-Tree is optimal for equality queries (`=`) and range queries (`<`, `<=`, `>`, `>=`, `BETWEEN`). It also supports sorting operations (`ORDER BY`) when the sort order matches the index order.

## Generalized Inverted Index (GIN)

GIN indexes are inverted indexes designed for handling composite values where an element contains sub-values, such as arrays, JSONB documents, and full-text search vectors (`tsvector`).

A GIN index stores a set of (key, posting list) pairs, where the posting list is a set of row IDs where the key occurs. This makes GIN ideal for:
- Full-text search with `@@` operator.
- JSONB containment with `@>` operator.
- Array overlap with `&&` operator.

The write overhead for GIN is higher than B-Tree because inserting a single row may require updating multiple keys in the index.

## Hierarchical Navigable Small World (HNSW)

HNSW is an approximate nearest neighbor (ANN) search algorithm designed for high-dimensional vector embeddings, implemented in PostgreSQL via the `pgvector` extension.

Key parameters for tuning HNSW:
- `m`: Maximum number of bidirectional links created for each new element during construction. Common values range between 16 and 64.
- `ef_construction`: Size of the dynamic candidate list during index build. Increasing this improves search recall at the expense of build time.
- `ef_search`: Size of the dynamic candidate list during query execution. Set at session level (`SET hnsw.ef_search = 100`).

HNSW builds a multi-layer graph where lower layers contain denser connections and upper layers contain long-range skips, similar to a skip list.
