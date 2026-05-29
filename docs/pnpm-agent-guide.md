# pnpm Setup and Usage Guide for Coding Agents

This guide captures the pnpm workflow used in this repository and adapts it into a reusable instruction set for a coding agent working in another project.

## What to standardize first

- Use `pnpm` as the package manager for all install, script, and binary-execution tasks.
- Pin a pnpm version so local development and container builds behave the same.
- Treat `pnpm-lock.yaml` as the authoritative lockfile.
- Avoid mixing package managers in the same project unless there is an explicit migration in progress.

## Recommended environment setup

1. Install a recent Node.js LTS release.
2. Enable Corepack so the repo can control the pnpm version.
3. Activate the pinned pnpm version for the project.

Example:

```bash
corepack enable
corepack prepare pnpm@10.33.2 --activate
pnpm --version
```

If the project already declares a `packageManager` field in `package.json`, prefer that version instead of hardcoding one manually.

## Install flow

Use a frozen install whenever the lockfile is already committed:

```bash
pnpm install --frozen-lockfile
```

Use a normal install only when you intentionally want to update dependencies and regenerate the lockfile:

```bash
pnpm install
```

If the repository has multiple `package.json` files, install from the correct package root:

- Root app: run `pnpm install` in the repository root.
- Nested app or backend: run `pnpm install` in that subdirectory.
- Workspace monorepo: use `pnpm --filter <package> install` or run from the workspace root, depending on the repo layout.

## Script usage pattern

Prefer the package scripts declared in `package.json` over calling binaries directly.

Common patterns:

```bash
pnpm dev
pnpm build
pnpm test
pnpm lint
pnpm preview
```

If the project has multiple packages, invoke the correct package explicitly:

```bash
cd backend
pnpm dev
```

or, in a workspace:

```bash
pnpm --filter backend dev
```

## Running package binaries

Use `pnpm exec` for tools that are installed in the project but not wrapped by a script.

Examples:

```bash
pnpm exec prisma generate
pnpm exec tsc --noEmit
pnpm exec next start
pnpm exec tsx scripts/seed.ts
```

`pnpm exec` is preferable to global installs because it guarantees the project-local version is used.

## Dependency management

- Add dependencies with `pnpm add <package>`.
- Add dev dependencies with `pnpm add -D <package>`.
- Remove packages with `pnpm remove <package>`.
- Update a dependency with `pnpm up <package>`.

After changing dependencies, commit both `package.json` and `pnpm-lock.yaml`.

## Lockfile rules

- Keep `pnpm-lock.yaml` in version control.
- Do not regenerate it with another package manager.
- If the repository also contains `package-lock.json` or `yarn.lock`, treat those as stale unless the project explicitly uses them.
- In CI and Docker, use `pnpm install --frozen-lockfile` to prevent drift.

## Workspace and multi-package projects

If the project is a monorepo:

- Use `pnpm-workspace.yaml` to declare packages.
- Prefer `pnpm --filter <package>` when targeting one package.
- Use `pnpm -r <script>` for repo-wide script execution when needed.
- Keep each package's scripts local and simple.

Example:

```bash
pnpm --filter frontend dev
pnpm --filter backend build
pnpm -r lint
```

## Docker and CI

If Docker is part of the project, pin pnpm in the image the same way local dev is pinned:

```dockerfile
RUN corepack enable \
  && corepack prepare pnpm@10.33.2 --activate
```

For CI:

- Install with `pnpm install --frozen-lockfile`.
- Run the same scripts the developer uses locally.
- Fail fast if the lockfile is out of sync.

## Agent guardrails

- Do not switch to npm or yarn just because the project has a `package-lock.json` or `yarn.lock` lying around.
- Do not use `npx` when `pnpm exec` is available.
- Do not edit generated lockfiles by hand.
- Do not assume the root and nested packages share the same dependency tree unless a pnpm workspace is configured.
- When changing scripts, update the README or agent docs so the expected pnpm commands stay discoverable.

## Minimal checklist for a new project

1. Pin pnpm with Corepack.
2. Commit `pnpm-lock.yaml`.
3. Use `pnpm install --frozen-lockfile` in CI and Docker.
4. Put all routine tasks behind `package.json` scripts.
5. Use `pnpm exec` for local binaries.
6. Use `pnpm --filter` only when the project is actually a workspace.
