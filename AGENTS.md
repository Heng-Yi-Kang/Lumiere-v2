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
Run commands from `frontend/`.

- `npm install`: install dependencies
- `npm run dev`: start the local Vite dev server on port 3000
- `npm run build`: create a production build in `dist/`
- `npm run preview`: serve the production build locally
- `npm run lint`: run TypeScript type-checking with `tsc --noEmit`
- `npm run clean`: remove generated build output

## Coding Style & Naming Conventions
Use TypeScript and React function components. Follow the existing project style:

- 2-space indentation
- `PascalCase` for components and view files, e.g. `DashboardView.tsx`
- `camelCase` for variables, helpers, and hooks
- keep component-specific styles and logic near the component

Path aliases are configured with `@/*` in `frontend/tsconfig.json`, so imports may use `@/components/...` instead of long relative paths.

## Testing Guidelines
There is no dedicated test runner configured yet. Treat `npm run lint` as the baseline verification step before committing changes. If you add tests, place them near the code they cover and use clear names that match the unit or view under test.

## Commit & Pull Request Guidelines
Commit history is short and uses concise imperative messages, sometimes with a prefix such as `feat:`. Keep commits focused and descriptive, for example `feat: add notebook sidebar state`.

Pull requests should include:

- a short summary of the change
- screenshots or screen recordings for UI work
- notes on any environment changes or new config values

## Security & Configuration Tips
Do not commit secrets. Copy `frontend/.env.example` to `.env.local` and set `GEMINI_API_KEY` locally before running the app.
