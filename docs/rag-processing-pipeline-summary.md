# RAG Processing Pipeline Summary

This note describes the current Retrieval-Augmented Generation pipeline used by the backend in `backend/`.

It is based on the implementation in:

- `backend/src/utils/embeddings.ts`
- `backend/src/utils/rag.ts`
- `backend/scripts/ingest-all-chapters.ts`
- `backend/src/app/api/rag/chat/route.ts`
- `backend/src/app/api/embeddings/search/route.ts`

## 1. What the pipeline does

The pipeline has two parts:

1. Ingestion: source PDFs are parsed, chunked, embedded, and stored in the `Chunk` table.
2. Retrieval: user queries are embedded, matching chunks are scored with cosine similarity, and the top results are returned to the LLM.

The current design is application-level RAG. There is no external vector database or database-native vector index involved in retrieval.

## 2. Storage model

The Prisma model is `Chunk`:

- `subject`: curriculum subject name
- `formLevel`: stored as a string such as `Form 4`
- `content`: chunk text
- `embedding`: float array
- `sourceType`: usually `textbook`, or `dskp` for DSKP content
- `metadata`: JSON object with source-specific details

The database has a simple index on `[subject, formLevel]`.

## 3. Ingestion flow

The main ingestion script is `backend/scripts/ingest-all-chapters.ts`.

### 3.1 Source discovery

The script scans `backend/textbooks/` for PDF files. It currently handles:

- Chapter PDFs grouped by subject and form level folders
- DSKP PDFs listed explicitly in the script

### 3.2 Text extraction

Each PDF is parsed with `pdf-parse` to produce raw text. If the extracted text is too short, ingestion fails for that file.

### 3.3 Chunking

Text is split with `splitIntoChunks(text, chunkSize, overlap)` from `backend/src/utils/embeddings.ts`.

Default chunking behavior:

- Paragraph-first splitting using blank lines
- Overlap created by backtracking over words from the previous chunk
- Sentence-level fallback for chunks larger than 1.5x the target size

The script uses different chunk settings depending on the source:

- Chapter PDFs: `2000` chars with `400` chars overlap
- DSKP PDFs: `1500` chars with `300` chars overlap

### 3.4 Embedding generation

Each chunk is embedded through the configured embedding endpoint.

Key implementation details:

- `probeEmbeddingCapability()` runs once and caches the result
- The embedding service may support:
  - `multimodal`
  - `batch_text`
  - `single_text`
- For normal text chunks, `generateEmbedding()` truncates input to `8000` characters
- Embedding requests retry on transient failures
- The script spaces chunk writes out with a delay to reduce service pressure

### 3.5 Persisting chunks

Each stored chunk includes:

- `subject`
- `formLevel`
- `content`
- `embedding`
- `sourceType`
- `metadata`

For chapter PDFs, metadata includes:

- `chapter`
- `sourceFileName`

For DSKP PDFs, metadata includes:

- `sourceFileName`
- `chunkIndex`

## 4. Retrieval flow

The main retrieval function is `retrieveRAGContext()` in `backend/src/utils/rag.ts`.

### 4.1 Inputs

Required inputs:

- `subject`
- `formLevel`
- `query`

Optional inputs:

- `limit` default `5`
- `coarseLimit` default `50`
- `sourceFileName`
- `sourceType`

### 4.2 Query embedding

The query text is embedded with `generateEmbedding(query)`.

If the embedding call returns an empty vector, retrieval exits early with no results.

### 4.3 Chunk filtering

Retrieval starts with all chunks for the requested subject, then narrows by source rules:

- If `sourceType` is provided, it filters directly on that type
- If `sourceType` is omitted, it combines:
  - DSKP chunks for the relevant DSKP form levels
  - non-DSKP chunks for the exact form level

There is a special form-level rule:

- For `Form 4` and `Form 5`, DSKP retrieval uses both `Form 4` and `Form 5`

If `sourceFileName` is provided, it additionally filters to that file name inside `metadata.sourceFileName`.

### 4.4 Similarity scoring

All candidate chunks are loaded from the database and scored in application code using cosine similarity.

Process:

1. Compute similarity for every chunk
2. Sort descending by similarity
3. Take the top `coarseLimit`
4. Slice again to the final `limit`

The function returns:

- `results`
- `totalChunks`
- `coarseChunksReturned`

### 4.5 No vector index

This implementation does not rely on a vector store or ANN index. That keeps the implementation simple, but retrieval cost grows linearly with the number of stored chunks.

## 5. Prompt formatting

`formatRAGContextForPrompt()` converts results into a text block for the LLM.

Each chunk is formatted as:

- a source label, such as `[TEXTBOOK]` or `[DSKP]`
- optional metadata in parentheses
- the raw chunk content

This formatted block is inserted into the system prompt or assistant context before calling the LLM.

## 6. API entry points

Two routes expose the RAG pipeline:

- `POST /api/embeddings/search`
  - Returns raw retrieval results for a subject, form level, and query
- `POST /api/rag/chat`
  - Retrieves RAG context
  - Prepends textbook context to the system prompt
  - Streams the LLM response back as SSE

The chat route uses the same retrieval function and then forwards the final prompt to the configured chat model.

## 7. Operational notes

- Source ingestion is offline and file-based
- Retrieval is deterministic for a given set of stored chunks and embeddings
- The pipeline depends on a working embedding service
- Re-indexing is effectively done by deleting existing matching chunks and running ingestion again

## 8. Practical constraints

Current trade-offs:

- Good for small and medium corpora
- Simpler to debug than a vector database
- Retrieval latency increases as chunk count grows

If the corpus expands significantly, the next likely improvement is to move from full in-app scoring to a vector search backend.

