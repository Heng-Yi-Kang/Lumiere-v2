# Repository Guidelines

## Project Structure & Module Organization
This repository is a pnpm workspace with a Vite + React + TypeScript frontend in `frontend/` and a Next.js backend in `backend/`.

- `frontend/src/`: frontend application source
- `frontend/src/components/`: UI components and feature views
- `frontend/src/data/`: frontend mock data and fixtures
- `frontend/assets/`: frontend static assets
- `frontend/index.html`: Vite entry page
- `frontend/.env.example`: frontend environment variable template
- `backend/src/`: backend routes, API handlers, and server-side libraries
- `backend/prisma/`: Prisma schema and migrations
- `backend/public/uploads/notebooks/`: stored notebook uploads in local development
- `backend/.env.example`: backend environment variable template
- `docs/`: implementation notes for routing, RAG, media processing, and deployment

Keep feature code close to the view or component that uses it. Prefer small, focused modules over large shared files unless the logic is reused.

## Build, Test, and Development Commands
Use `pnpm` for installs and scripts. Workspace-level commands run from the repository root. Package-specific commands can run from `frontend/` or `backend/` as needed.

Workspace:

- `pnpm install`: install workspace dependencies
- `pnpm dev:frontend`: start the Vite frontend on port 3000
- `pnpm dev:backend`: start the Next.js backend on port 3001
- `pnpm build:frontend`: build the frontend
- `pnpm build:backend`: build the backend
- `pnpm typecheck:frontend`: run frontend TypeScript checks
- `pnpm typecheck:backend`: run backend TypeScript checks
- `pnpm test:llm:backend`: run the backend LLM connectivity test script
- `pnpm test:llm`: alias for `pnpm test:llm:backend`
- `pnpm db:up`: start PostgreSQL, Qdrant, and pgAdmin with Docker Compose
- `pnpm db:down`: stop Docker services

Frontend package:

- `pnpm install --frozen-lockfile`: install dependencies from the committed lockfile
- `pnpm dev`: start the local Vite dev server on port 3000
- `pnpm build`: create a production build in `dist/`
- `pnpm preview`: serve the production build locally
- `pnpm lint`: run TypeScript type-checking with `tsc --noEmit`
- `pnpm typecheck`: run the TypeScript compiler without emitting files
- `pnpm check`: run type-checking and a production build
- `pnpm clean`: remove generated build output
- no dedicated frontend unit or integration test script is currently defined

Backend package:

- `pnpm dev`: start the local Next.js backend on port 3001
- `pnpm build`: create the production backend build
- `pnpm test`: run the backend Vitest suite
- `pnpm test:llm`: run backend LLM connectivity checks
- `pnpm test:llm:chat`: run only chat-provider connectivity checks
- `pnpm test:llm:embeddings`: run only embeddings-provider connectivity checks
- `pnpm test:vlm`: run the VLM connectivity Vitest file
- `pnpm typecheck`: run backend TypeScript checks
- `pnpm lint`: run backend TypeScript checks
- `pnpm prisma:migrate:dev`: apply Prisma migrations in development
- `pnpm prisma:generate`: regenerate Prisma client after schema changes

## Coding Style & Naming Conventions
Use TypeScript throughout. Follow the existing project style:

- 2-space indentation
- `PascalCase` for React components and view files, e.g. `DashboardView.tsx`
- `camelCase` for variables, helpers, hooks, and backend library functions
- keep component-specific styles and logic near the component

Path aliases are configured with `@/*` in both app packages, so imports may use `@/components/...` or `@/lib/...` instead of long relative paths.

## Frontend Routing Guidelines
The frontend uses React Router plus semantic page-name navigation. The source of truth is the `pageToPath` registry in `frontend/src/App.tsx`; keep it aligned with the rendered `<Routes>` tree.

- Use `setCurrentPage('PageName')` for shell-level navigation from layout, the floating dock, and top-level page actions.
- Derive active navigation state from the current route, not independent tab state.
- Keep query strings for contextual detail state. For example, notebook detail views use `/notebooks?notebookId=<id>` while the logical page remains `Notebooks`.
- When adding a page, update `pageToPath`, `pathToPage` coverage through the registry, the `<Routes>` declaration, and any floating dock/search entry that should expose the page.
- The current shell-level pages are `Dashboard`, `Notebooks`, and `KnowledgeGraph`. `Study Buddy` is no longer a dock route.
- See `docs/frontend-routing.md` before changing routing behavior.

## Backend and RAG Notes

- The backend uses PostgreSQL for notebook, file, and chunk-manifest metadata and Qdrant for vector retrieval storage.
- Grounded notebook chat, file ingestion, retrieval, reranking, and cleanup behavior are documented in [`docs/rag-processing.md`](docs/rag-processing.md).
- For the default local workflow, only PostgreSQL, Qdrant, and pgAdmin run in Docker while the backend runs on the host with `pnpm dev:backend`; keep `backend/.env` set to `QDRANT_URL=http://localhost:6333`.
- Use `QDRANT_URL=http://qdrant:6333` only when the backend itself runs inside the same Docker Compose network. A host-run backend cannot resolve the `qdrant` Compose service name and will fail startup with `qdrant-connectivity`.
- Video and image enrichment rely on VLM configuration in `backend/.env`; see [`docs/video-processing.md`](docs/video-processing.md) for the current flow.
- Swagger UI is served from `/api` and the OpenAPI document from `/api/openapi.json`.
- Startup health checks run during backend boot and can fail startup when required dependencies are unavailable.

## Testing Guidelines
The frontend currently uses `pnpm lint` or `pnpm check` as the baseline verification step and does not yet define a dedicated test runner. The backend has a dedicated Vitest suite; use `pnpm --dir backend test` for backend changes and `pnpm --dir backend typecheck` for server-side type verification. Use `pnpm --dir backend test:llm`, `pnpm --dir backend test:llm:chat`, `pnpm --dir backend test:llm:embeddings`, and `pnpm --dir backend test:vlm` when you need provider-connectivity coverage in addition to the main test suite. If you add tests, place them near the code they cover and use clear names that match the unit, route, or view under test.

## Commit & Pull Request Guidelines
Commit history is short and uses concise imperative messages, sometimes with a prefix such as `feat:`. Keep commits focused and descriptive, for example `feat: add notebook sidebar state`.

Pull requests should include:

- a short summary of the change
- screenshots or screen recordings for UI work
- notes on any environment changes or new config values

## Security & Configuration Tips
Do not commit secrets. Copy `backend/.env.example` to `backend/.env` before running the backend, and copy `frontend/.env.example` to `.env.local` only if you add frontend-local configuration. Keep Docker database settings aligned with backend Prisma settings. Example Docker configuration is only a template; on deployment servers it should be copied into the production Docker configuration, which is not tracked by git.

## pnpm Workflow Notes
Follow the repository guide in [`docs/pnpm-agent-guide.md`](docs/pnpm-agent-guide.md) when changing dependencies or running package scripts.
- Prefer `pnpm add`, `pnpm remove`, and `pnpm up` for dependency changes.
- Keep `pnpm-lock.yaml` authoritative once it is generated for the frontend.
- Use `pnpm exec` for project-local binaries that are not wrapped by scripts.
