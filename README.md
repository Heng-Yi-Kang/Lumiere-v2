# Lumiere

This repository contains a Vite frontend in `frontend/` and a Next.js backend in `backend/`, with PostgreSQL, Qdrant, pgvector support in PostgreSQL, and pgAdmin provided through Docker.

## Deployed Project

View the deployed project at [https://yikang.org](https://yikang.org).

## Key Features

Lumiere is an AI-assisted study workspace for organizing course notebooks, uploading learning materials, and asking grounded questions over indexed content.

- **Authenticated study workspaces:** first-party email/password accounts with HTTP-only cookie sessions keep notebooks, files, notes, goals, and RAG queries scoped to the signed-in user.
- **Notebook-centered course organization:** learners can create notebooks by course or topic, edit notebook metadata, upload materials, browse files, and keep contextual detail state through direct URLs such as `/notebooks?notebookId=<id>`.
- **Multi-format material ingestion:** notebook uploads support PDF, DOCX, PPTX, TXT, common image files, audio files, and video files, with local upload storage and preview generation for supported content.
- **Audio and video understanding:** audio uploads are transcribed through the configured STT provider; video uploads extract audio, sample frames with `ffmpeg`, describe frames through the VLM provider, and index timestamped transcript/visual segments. Uploaded videos also get background HLS playback assets while the original upload remains the source for STT, frame sampling, summaries, embeddings, and Qdrant indexing.
- **Grounded notebook chat:** Study Buddy and file-level chat use retrieved notebook chunks to answer questions with citations, and can be scoped to a whole notebook or a single uploaded file.
- **Retrieval-augmented search:** the backend chunks extracted material, generates embeddings, stores vectors in Qdrant, keeps chunk manifests in PostgreSQL, and validates retrieval hits against the current notebook/file records.
- **AI-generated file summaries:** uploaded files with extracted text can receive asynchronous summaries with visible generation states (`idle`, `in-progress`, `done`, `error`).
- **File notes and revision support:** learners can attach notes to uploaded files, review markdown-rich chat output, and use study prompts for summaries, exam angles, checklists, and revision questions.
- **Dashboard goals and streaks:** the dashboard tracks per-user study goals, priority goals, and study streak activity.
- **Knowledge graph view:** the frontend includes a semantic concept graph for exploring prerequisites, mastery status, and course-level relationships.
- **Admin console:** admin users can review user/account stats, enable or disable users, change roles, and manage sessions through the `/admin` page.
- **Operational observability:** backend startup health checks validate required providers and infrastructure, while Swagger UI and OpenAPI JSON expose the API surface for local inspection.

## Local Setup Guide

Follow these steps from a fresh clone to a running local Lumiere workspace.

### 1. Install prerequisites

Install:

- Node.js 22 LTS or another recent Node.js release compatible with the project dependencies
- Corepack, usually bundled with Node.js
- Docker Desktop or Docker Engine with Docker Compose
- `ffmpeg` and `ffprobe` if you plan to ingest audio or video files or generate HLS playback assets

Enable the pnpm version pinned by the workspace:

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version
```

The root [`package.json`](package.json) declares `pnpm@10.33.2`. Use pnpm for all installs and scripts in this repository.

### 2. Clone and install dependencies

```bash
git clone <repository-url>
cd Lumiere-v2
pnpm install --frozen-lockfile
```

Use plain `pnpm install` only when intentionally updating dependencies or regenerating the lockfile.

### 3. Create local environment files

Copy the Docker service defaults:

```bash
cp .env.example .env
```

Copy the backend runtime configuration:

```bash
cp backend/.env.example backend/.env
```

For the default local workflow, keep these values aligned:

```env
DATABASE_URL=postgresql://lumiere:lumiere@localhost:5432/lumiere?schema=public
FRONTEND_ORIGIN=http://localhost:3000
QDRANT_URL=http://localhost:6333
SESSION_COOKIE_SAME_SITE=lax
```

Do not set `QDRANT_URL=http://qdrant:6333` when running the backend on the host with `pnpm dev:backend`; that hostname only works from containers on the Docker Compose network.

Frontend environment is optional for local development. The Vite dev server proxies `/api` and `/uploads` to `http://localhost:3001` by default. Only create `frontend/.env.local` when you need to override the backend target:

```env
VITE_API_PROXY_TARGET=http://localhost:3001
# or, when the browser must call a separate backend origin directly:
# VITE_API_BASE_URL=http://localhost:3001
```

### 4. Configure AI providers

The backend startup health checks require working database, Qdrant, upload storage, and embeddings configuration. Grounded chat and summaries also need chat configuration. Edit `backend/.env` and set provider values for the capabilities you want to use:

```env
CHAT_API_BASE_URL=https://openrouter.ai/api/v1
CHAT_API_KEY=your-provider-key
CHAT_MODEL=qwen/qwen3.5-9b
CHAT_API_TIMEOUT_MS=120000

EMBEDDING_API_BASE=https://openrouter.ai/api/v1
EMBEDDING_API_KEY=your-provider-key
EMBEDDING_MODEL=google/gemini-embedding-2

STT_API_BASE=https://openrouter.ai/api/v1
STT_API_KEY=your-provider-key
STT_MODEL=qwen3-asr-1.7b
STT_REQUEST_FORMAT=multipart

VLM_API_BASE_URL=https://openrouter.ai/api/v1
VLM_API_KEY=your-provider-key
VLM_MODEL=qwen/qwen3-vl-235b-a22b-instruct

ENABLE_RERANKING=false
```

Minimum useful setup:

- Set `EMBEDDING_*` to boot the current RAG-backed backend successfully.
- Set `CHAT_*` for Study Buddy and generated summaries.
- Set `STT_*` for audio and video transcription.
- Set `VLM_*` for image descriptions and video frame understanding.
- Leave `ENABLE_RERANKING=false` unless you have a compatible reranker endpoint and model.

After changing provider variables, restart the backend. Use `pnpm test:llm:backend` later to verify chat and embeddings connectivity.

### 5. Start local data services

Start PostgreSQL, Qdrant, and pgAdmin:

```bash
pnpm db:up
```

Check service status if startup takes longer than expected:

```bash
docker compose ps
pnpm db:logs
```

The local Docker stack exposes:

- PostgreSQL on `localhost:5432`
- Qdrant on `http://localhost:6333`
- pgAdmin on `http://localhost:5050`

pgAdmin uses the defaults from `.env`: `admin@lumiere.local` / `admin123`.

### 6. Prepare the database

Generate the Prisma client and apply local migrations:

```bash
pnpm --dir backend prisma:generate
pnpm --dir backend prisma:migrate:dev
```

For an existing local database after auth or RAG schema changes, stale local artifacts may still exist outside PostgreSQL. If you need a clean development environment, stop services and remove Docker volumes:

```bash
pnpm db:reset
pnpm db:up
pnpm --dir backend prisma:migrate:dev
```

`pnpm db:reset` deletes local PostgreSQL, Qdrant, and pgAdmin volumes.

### 7. Run the backend

In one terminal:

```bash
pnpm dev:backend
```

The backend starts on `http://localhost:3001`. On boot it validates required infrastructure and provider connectivity. If startup fails, check `backend/.env`, Qdrant reachability, PostgreSQL reachability, and provider API keys.

Useful backend URLs:

- API docs: `http://localhost:3001/api`
- OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- Health check: `http://localhost:3001/api/health`

### 8. Run the frontend

In a second terminal:

```bash
pnpm dev:frontend
```

Open `http://localhost:3000`. Local API calls should work through the Vite proxy without setting `VITE_API_BASE_URL`.

### 9. Sign in

Create a regular local workspace from the sign-up screen, or use the local/demo admin account:

```text
Email: admin@lumiere.my
Password: admin1234
```

The backend ensures this admin account exists on startup and during admin login. Treat it as local/demo behavior only.

### 10. Verify the setup

Run the baseline checks that match the area you changed:

```bash
pnpm typecheck:frontend
pnpm typecheck:backend
pnpm --dir backend test
pnpm test:llm:backend
```

For media provider checks:

```bash
pnpm --dir backend test:vlm
```

### Common setup issues

- `qdrant-connectivity` during backend startup: make sure Docker is running, `pnpm db:up` completed, and `backend/.env` uses `QDRANT_URL=http://localhost:6333` for host-run backend development.
- Prisma cannot connect: make sure `.env` and `backend/.env` use the same database credentials and port, then check `docker compose ps`.
- Browser login succeeds but later requests are unauthenticated: keep local `FRONTEND_ORIGIN=http://localhost:3000` and `SESSION_COOKIE_SAME_SITE=lax`; avoid cross-origin `VITE_API_BASE_URL` unless you also configure cookies for that flow.
- Upload or preview files fail: make sure `backend/public/uploads/notebooks/` exists and is writable by the backend process.
- Audio or video ingestion fails: install `ffmpeg`/`ffprobe` and configure `STT_*`; configure `VLM_*` for video frame descriptions.
- Video preview falls back to the original file: HLS generation runs after upload in a background job. Check `NotebookFile.hlsStatus`; failed HLS generation does not block transcript extraction, VLM analysis, summaries, embeddings, or Qdrant indexing.
- LLM connectivity tests fail: verify the provider base URL, API key, model name, timeout, and whether the provider expects multipart or JSON STT requests.

## Sign Up, Sign In, and Use Lumiere

After starting the frontend and backend, open `http://localhost:3000`. Lumiere shows the authentication screen when no active session is found.

- To create a new workspace, choose **Sign up**, enter your name, email address, and password, then submit the form.
- To return to an existing workspace, choose **Log in**, enter the same email address and password, then submit the form.
- Sessions are stored in HTTP-only cookies, so your notebooks, files, notes, goals, and chat history remain scoped to the signed-in account.

Once signed in:

- Use the **Dashboard** to review study goals, priority work, and streak activity.
- Use **Notebooks** to create course or topic workspaces, edit notebook metadata, and open notebook detail pages.
- Upload PDFs, DOCX, PPTX, TXT, images, audio, videos, or web links inside a notebook so Lumiere can extract, summarize, and index the material.
- Open uploaded files to preview supported content, add notes, retry summaries, and ask file-scoped questions.
- Use **Study Buddy** from notebook and file actions to ask grounded questions over indexed material with citations.
- Use the **Knowledge Graph** to explore concepts, prerequisites, mastery status, and course relationships.

Admin users can open `http://localhost:3000/admin` after signing in with an account that has the `ADMIN` role. The admin console is for reviewing account stats, enabling or disabling users, changing roles, and managing sessions.

## Test Scripts

Workspace-level test and verification commands from the repository root:

- `pnpm typecheck:frontend`: run the frontend TypeScript checker
- `pnpm typecheck:backend`: run the backend TypeScript checker
- `pnpm test:llm:backend`: run the backend LLM connectivity test script
- `pnpm test:llm`: alias for `pnpm test:llm:backend`

Frontend validation commands from `frontend/`:

- `pnpm lint`: run `tsc --noEmit`
- `pnpm typecheck`: run `tsc --noEmit`
- `pnpm check`: run TypeScript checks and a production build

The frontend does not currently define a dedicated unit or integration test script.

Backend test and verification commands from `backend/`:

- `pnpm test`: run the backend Vitest suite
- `pnpm test:llm`: run the backend LLM connectivity checks
- `pnpm test:llm:chat`: run only chat-provider connectivity checks
- `pnpm test:llm:embeddings`: run only embeddings-provider connectivity checks
- `pnpm test:vlm`: run the VLM connectivity test file with Vitest
- `pnpm typecheck`: run the backend TypeScript checker
- `pnpm lint`: run the backend TypeScript checker

## Service Endpoints

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Backend API docs: `http://localhost:3001/api`
- Backend OpenAPI JSON: `http://localhost:3001/api/openapi.json`
- Backend health: `http://localhost:3001/api/health`
- PostgreSQL: `localhost:5432`
- Qdrant: `http://localhost:6333`
- pgAdmin: `http://localhost:5050`

## Qdrant URL Configuration

The default local workflow runs only PostgreSQL, Qdrant, and pgAdmin in Docker. The backend is started on the host with `pnpm dev:backend`, so `backend/.env` should use:

```env
QDRANT_URL=http://localhost:6333
```

Use `http://qdrant:6333` only for a backend process that is also running inside the same Docker Compose network. If the host-run backend is configured with `http://qdrant:6333`, startup health checks fail with `qdrant-connectivity` because the host cannot resolve the Compose service name.

## AI Provider and Model Configuration

Lumiere talks to AI services through OpenAI-compatible HTTP APIs. Configure providers in `backend/.env` by copying [`backend/.env.example`](backend/.env.example), then setting the base URL, API key, and model name for each capability you want to use.

The main provider groups are:

- `CHAT_*`: grounded notebook chat and asynchronous file summaries. Requests are sent to `/chat/completions`.
- `EMBEDDING_*`: required for RAG indexing and retrieval. Requests are sent to `/embeddings`.
- `STT_*`: audio and video transcription. Requests are sent to `/audio/transcriptions`.
- `VLM_*`: image uploads and video frame descriptions. Requests are sent through chat-completion style vision messages.
- `RERANKER_*`: optional retrieval reranking. Enabled only when `ENABLE_RERANKING=true`; requests are sent to `/rerank`.

Example OpenAI-compatible configuration:

```env
CHAT_API_BASE_URL=https://openrouter.ai/api/v1
CHAT_API_KEY=your-provider-key
CHAT_MODEL=qwen/qwen3.5-9b
CHAT_API_TIMEOUT_MS=120000

EMBEDDING_API_BASE=https://openrouter.ai/api/v1
EMBEDDING_API_KEY=your-provider-key
EMBEDDING_MODEL=google/gemini-embedding-2

STT_API_BASE=https://openrouter.ai/api/v1
STT_API_KEY=your-provider-key
STT_MODEL=qwen3-asr-1.7b
# multipart is the OpenAI-compatible default. Use json for providers that expect base64 audio JSON.
STT_REQUEST_FORMAT=json

VLM_API_BASE_URL=https://openrouter.ai/api/v1
VLM_API_KEY=your-provider-key
VLM_MODEL=qwen/qwen3-vl-235b-a22b-instruct

ENABLE_RERANKING=false
RERANKER_API_BASE=
RERANKER_API_KEY=
RERANKER_MODEL=Qwen/Qwen3-Reranker-8B
```

To switch providers, keep the same environment variable names and replace only the `*_API_BASE*`, `*_API_KEY`, and `*_MODEL` values with the provider's OpenAI-compatible endpoint and model identifiers. `CHAT_API_BASE_URL` and VLM base URLs default to `https://api.openai.com/v1` when omitted, but embeddings, STT, and enabled reranking require explicit provider settings.

VLM settings fall back to chat settings when `VLM_API_KEY` or `VLM_MODEL` is not set, so a multimodal chat model can serve both text chat and image/video description. Use dedicated `VLM_*` values when your vision model, endpoint, or key differs from chat.

After editing `backend/.env`, restart the backend so startup health checks can validate the required providers. Use `pnpm test:llm:backend` for chat and embeddings connectivity, and `pnpm --dir backend test:vlm` when you need a VLM connectivity check.

## Frontend Routing

The frontend uses React Router for direct URL access while keeping app navigation based on semantic page names. The route registry lives in [`frontend/src/App.tsx`](frontend/src/App.tsx):

- `Dashboard` -> `/dashboard`
- `Notebooks` -> `/notebooks`

The floating macOS-style dock and other shell-level navigation should call `setCurrentPage('PageName')` instead of pushing raw URLs. Detail context can still use query parameters; notebook detail selection uses `/notebooks?notebookId=<id>`. The `Study Buddy` panel still exists, but it is opened from in-app actions rather than from a shell-level dock item.

See [`docs/frontend-routing.md`](docs/frontend-routing.md) for the routing pattern and maintenance rules.

## Retrieval and AI services

Notebook retrieval uses PostgreSQL for notebook and file metadata plus chunk manifests, and Qdrant for vector storage and retrieval. Qdrant is required for the current RAG flow. Reranking is optional and is only enabled when `ENABLE_RERANKING=true`. Image and video enrichment uses the VLM configuration in [`backend/.env.example`](backend/.env.example), with fallback to chat provider settings where supported.

## Further Reading

| Topic | Read this | Why |
| --- | --- | --- |
| Architecture overview | [`docs/architecture-overview.md`](docs/architecture-overview.md) | Onboarding map of the workspace, routing model, backend API layout, and RAG data flow |
| Frontend routing | [`docs/frontend-routing.md`](docs/frontend-routing.md) | Route registry, page-name navigation, and query-string detail state |
| RAG processing | [`docs/rag-processing.md`](docs/rag-processing.md) | Chunking, Qdrant storage, retrieval, and grounded chat behavior |
| PDF uploads | [`docs/pdf-upload-processing.md`](docs/pdf-upload-processing.md) | PDF validation, `officeparser` extraction, preview behavior, RAG indexing, and summary flow |
| DOCX uploads | [`docs/docx-upload-processing.md`](docs/docx-upload-processing.md) | DOCX `mammoth` extraction, sanitized HTML previews, RAG indexing, and summary flow |
| PPTX uploads | [`docs/pptx-upload-processing.md`](docs/pptx-upload-processing.md) | PPTX slide and notes extraction, sanitized previews, RAG indexing, and summary flow |
| TXT uploads | [`docs/txt-upload-processing.md`](docs/txt-upload-processing.md) | Plain-text reading, preview storage, RAG indexing, and summary flow |
| Image uploads | [`docs/image-upload-processing.md`](docs/image-upload-processing.md) | VLM image descriptions, immediate image summaries, and description-based RAG indexing |
| Audio uploads | [`docs/audio-processing.md`](docs/audio-processing.md) | Notebook audio transcription, preview generation, and indexing flow |
| Video uploads | [`docs/video-processing.md`](docs/video-processing.md) | Video transcription, frame description, timestamped preview, and RAG chunking |
| Web link uploads | [`docs/web-link-upload-processing.md`](docs/web-link-upload-processing.md) | Public HTML link validation, Puppeteer scraping, readable-text extraction, and optional RAG indexing |
| File summaries | [`docs/SUMMARY_GENERATION.md`](docs/SUMMARY_GENERATION.md) | `NotebookFile` summary states, async summary job flow, large-file chunk sampling, and provider behavior |

## Database and config

The local stack started by `pnpm db:up` brings up three services:

- PostgreSQL for notebooks, files, notes, and `NotebookFileChunk` manifests
- Qdrant for chunk embeddings and retrieval payloads
- pgAdmin for database inspection during development

The PostgreSQL container uses `pgvector/pgvector:0.8.2-pg16`, and the init script in [`docker/postgres/init/001-enable-pgvector.sql`](docker/postgres/init/001-enable-pgvector.sql) enables the `vector` extension at boot. That said, the current RAG flow stores embeddings in Qdrant, not in PostgreSQL; PostgreSQL remains the source of truth for app data and chunk indexing history.

Docker-side defaults for PostgreSQL, pgAdmin, ports, and the host `DATABASE_URL` live in [`.env.example`](.env.example) and can be overridden in your local `.env` file. Backend runtime settings live in [`backend/.env.example`](backend/.env.example); Prisma reads `backend/.env` through `dotenv/config`, so keep `DATABASE_URL` aligned with the Docker database settings. For the standard host-run backend workflow, keep `QDRANT_URL=http://localhost:6333`.

Useful local database commands from the repository root:

- `pnpm db:up`: start PostgreSQL, Qdrant, and pgAdmin
- `pnpm db:down`: stop the local data services
- `pnpm db:logs`: stream Docker service logs
- `pnpm db:reset`: remove containers and named volumes

The backend startup path now runs provider reachability checks on server boot. Required dependencies such as embeddings, Qdrant, database access, and upload storage can fail startup; optional providers such as reranking and some media-specific flows degrade the health report instead.
