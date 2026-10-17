# Notes on Web Application Development

## Docker

Docker is a tool for running applications in isolated containers. A container holds everything the application needs to run: the program, its libraries and its settings. Thanks to this, the application behaves the same on a developer's laptop and on a server, and the classic problem of "it works on my machine" goes away.

An image is an immutable template from which containers are created. A container is a running instance of an image. Several containers can run from a single image at the same time. Images are downloaded from a registry, and the best known one is Docker Hub.

Containers are ephemeral by design: when a container is removed, everything stored inside it disappears as well. A volume is used to store data permanently. It is storage managed by Docker and independent of the container's lifetime. A database running in a container should therefore always keep its data in a volume.

Docker Compose lets you describe several services in a single docker-compose.yml file, for example a database, a backend and a frontend. One command, docker compose up, starts all of them together. This is handy for local development, because a new team member does not have to install anything by hand.

## PostgreSQL and pgvector

PostgreSQL is an open-source relational database known for its reliability and rich feature set. It supports transactions, complex queries, JSON columns and full-text search. Data is stored in tables and queried with the SQL language.

The pgvector extension adds a new column type called vector to PostgreSQL, which stores numeric vectors. It makes it possible to search for records by similarity instead of exact match. The most common choice is cosine distance, which measures the angle between two vectors.

The HNSW index speeds up the search for nearest neighbors in a large collection of vectors. Instead of scanning every row, it walks through a graph in which similar vectors are linked together. The price for the speed is that the result is approximate and not always perfectly exact.

Full-text search in PostgreSQL is built around the tsvector type, which contains normalized words from a text. A query is written as a tsquery. A GIN index is used to speed it up. Unlike vectors, it looks for matches of concrete words, so it finds exact names, acronyms and numbers very well.

## Embeddings and RAG

An embedding is a way to turn text into a list of numbers that captures its meaning. Texts with a similar meaning have similar vectors, even when they use different words. For example, a question about keeping data permanently can end up close to a paragraph about volumes, even though the word permanently does not appear in it.

The embedding model must be the same for documents and for questions, otherwise the vectors cannot be compared. Every model returns vectors of a fixed length, for example 768 numbers, and the database column has to be configured to match that length. When the model is changed, all embeddings have to be recomputed.

RAG, short for Retrieval-Augmented Generation, is a technique in which a language model first receives relevant passages from your own documents and only then answers. The application turns the question into a vector, finds the most similar pieces of text in the database and inserts them into the prompt. The model then answers from the supplied material and can provide citations.

The quality of a RAG system depends on two parts: retrieval and answer generation. If retrieval does not find the right passage, even the best model cannot invent the answer out of nothing. That is why it pays off to measure retrieval quality, for example by checking whether the correct passage appears among the top five results.

Chunking means splitting a long document into smaller parts. Pieces that are too large blur the meaning and take up a lot of room in the prompt, while pieces that are too small lose context. A common compromise is to split by paragraphs with an upper limit on length.

## Git and working with a repository

Git is a version control system that remembers the history of changes in a project. Every commit is a record of the state of the files at a certain point in time. Thanks to this it is possible to return to an older version or to find out who changed a particular line and when.

The .gitignore file contains a list of files that Git should not track. The node_modules folder and the .env file with secret values, such as passwords and API keys, belong there. Once a secret value gets into the history of a repository, it stays there even after the file is deleted.

The git push command uploads local commits to a remote repository, for example on GitHub. The git pull command downloads changes from it. When working in a team, branches are usually created in which a new feature is developed, and after review they are merged into the main branch through a pull request.

## Bun and TypeScript

Bun is a fast tool for JavaScript and TypeScript that combines a runtime, a package manager and a test runner. It can run TypeScript directly without a separate compilation step and automatically loads variables from the .env file. It is an alternative to Node.js and npm.

TypeScript adds static types to JavaScript. Mistakes such as a wrong argument type or a typo in a property name are caught by the editor before the program is even run. In larger projects this makes maintenance and refactoring much easier.

Drizzle ORM is a library that lets you define database tables in TypeScript and write type-safe queries. The schema is described in code and the drizzle-kit tool applies it to the database. Queries stay close to SQL, so the developer keeps control over what really happens in the database.

## Environment variables

Environment variables are application settings that are kept outside the source code. Typical examples are the database address, a model name or an API key. During local development they are stored in the .env file, and on a server they are set in the hosting configuration.

A good habit is to create a .env.example file with the same variable names but without secret values, and to commit that file to the repository. A new developer then knows which variables the application needs and only has to copy the file and fill it in.
