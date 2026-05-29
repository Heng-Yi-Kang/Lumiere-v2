# Repository Guidelines

## Project Structure & Module Organization
This repository is a Vite + React + TypeScript frontend. The app lives under `frontend/`.

- `frontend/src/`: application source
- `frontend/src/components/`: UI components and feature views
- `frontend/src/data/`: local mock data and fixtures
- `frontend/assets/`: static assets
- `frontend/index.html`: Vite entry page
- `frontend/.env.example`: environment variable template

Keep feature code close to the view or component that uses it. Prefer small, focused modules over large shared files unless the logic is reused.

## Build, Test, and Development Commands
Run commands from `frontend/` and use `pnpm` for installs and scripts.

- `pnpm install --frozen-lockfile`: install dependencies from the committed lockfile
- `pnpm dev`: start the local Vite dev server on port 3000
- `pnpm build`: create a production build in `dist/`
- `pnpm preview`: serve the production build locally
- `pnpm lint`: run TypeScript type-checking with `tsc --noEmit`
- `pnpm typecheck`: run the TypeScript compiler without emitting files
- `pnpm check`: run type-checking and a production build
- `pnpm clean`: remove generated build output

## Coding Style & Naming Conventions
Use TypeScript and React function components. Follow the existing project style:

- 2-space indentation
- `PascalCase` for components and view files, e.g. `DashboardView.tsx`
- `camelCase` for variables, helpers, and hooks
- keep component-specific styles and logic near the component

Path aliases are configured with `@/*` in `frontend/tsconfig.json`, so imports may use `@/components/...` instead of long relative paths.

## Testing Guidelines
There is no dedicated test runner configured yet. Treat `pnpm lint` or `pnpm check` as the baseline verification step before committing changes. If you add tests, place them near the code they cover and use clear names that match the unit or view under test.

## Commit & Pull Request Guidelines
Commit history is short and uses concise imperative messages, sometimes with a prefix such as `feat:`. Keep commits focused and descriptive, for example `feat: add notebook sidebar state`.

Pull requests should include:

- a short summary of the change
- screenshots or screen recordings for UI work
- notes on any environment changes or new config values

## Security & Configuration Tips
Do not commit secrets. Copy `frontend/.env.example` to `.env.local` and set `GEMINI_API_KEY` locally before running the app.

## pnpm Workflow Notes
Follow the repository guide in [`docs/pnpm-agent-guide.md`](docs/pnpm-agent-guide.md) when changing dependencies or running package scripts.
- Prefer `pnpm add`, `pnpm remove`, and `pnpm up` for dependency changes.
- Keep `pnpm-lock.yaml` authoritative once it is generated for the frontend.
- Use `pnpm exec` for project-local binaries that are not wrapped by scripts.
