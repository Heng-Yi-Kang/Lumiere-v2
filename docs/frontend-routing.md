# Frontend Routing and Page-Name Navigation

The Lumiere frontend uses React Router for URL matching, but shell navigation is expressed through logical page names such as `Dashboard`, `Notebooks`, and `KnowledgeGraph`.

The routing source of truth lives in [`frontend/src/App.tsx`](../frontend/src/App.tsx).

## Core idea

`App.tsx` defines a page registry and exposes `setCurrentPage(pageName)` to shell navigation. Components that move between top-level screens should use page names instead of raw URLs.

This gives the app two layers:

1. URL routing through React Router.
2. UI navigation through stable page identifiers.

React Router owns direct browser access, refreshes, and back/forward behavior. The page-name layer keeps sidebar highlighting and top-level navigation tied to semantic screens instead of string paths scattered through components.

## Route registry

`App.tsx` defines `pageToPath`:

```ts
const pageToPath = {
  Dashboard: '/dashboard',
  Notebooks: '/notebooks',
  KnowledgeGraph: '/knowledge-graph',
} as const;
```

It then derives `pathToPage`:

```ts
const pathToPage = Object.fromEntries(
  Object.entries(pageToPath).map(([page, path]) => [path, page]),
) as Record<string, string>;
```

Use `pageToPath` when navigating by page name. Use `pathToPage` to derive the logical page from `location.pathname`.

## Current page derivation

`App.tsx` computes the active page from the URL:

```ts
const location = useLocation();
const currentPage = pathToPage[location.pathname] ?? 'Dashboard';
```

Only the pathname determines the logical page. Query strings are intentionally ignored for active-page decisions.

For example, `/notebooks?notebookId=abc` still resolves to `Notebooks`.

## Page-name navigation

`App.tsx` exposes:

```ts
const setCurrentPage = useCallback((page: string) => {
  navigate(pageToPath[page as keyof typeof pageToPath] ?? pageToPath.Dashboard);
}, [navigate]);
```

Behavior:

- Components pass a logical page name.
- `setCurrentPage` resolves it through `pageToPath`.
- Unknown page names fall back to `/dashboard`.
- The URL change updates `currentPage`, which updates sidebar active state.

This fallback is useful, but it can hide missing registry entries. When adding a route, keep the registry and `<Routes>` declaration synchronized.

## Rendered routes

The actual route tree is also in `App.tsx`:

```tsx
<Routes>
  <Route path="/" element={<Navigate to={pageToPath.Dashboard} replace />} />
  <Route path={pageToPath.Dashboard} element={<DashboardView ... />} />
  <Route path={pageToPath.Notebooks} element={<NotebookView ... />} />
  <Route path={pageToPath.KnowledgeGraph} element={<KnowledgeGraphView ... />} />
  <Route path="*" element={<Navigate to={pageToPath.Dashboard} replace />} />
</Routes>
```

The root URL and unknown routes redirect to `/dashboard`.

## Notebook detail context

Notebook selection is contextual state on the `Notebooks` page. It is stored in the query string:

```ts
const activeNotebookId = currentPage === 'Notebooks'
  ? new URLSearchParams(location.search).get('notebookId')
  : null;
```

Opening a notebook navigates to:

```ts
/notebooks?notebookId=<id>
```

Clearing selection navigates back to:

```ts
/notebooks
```

This keeps notebook detail views deep-linkable while preserving `Notebooks` as the active sidebar page.

## Sidebar contract

[`frontend/src/components/Sidebar.tsx`](../frontend/src/components/Sidebar.tsx) receives:

```ts
currentPage: string;
setCurrentPage: (page: string) => void;
```

Sidebar items store page names, not URL paths:

```ts
{ page: 'Dashboard', label: 'Dashboard', icon: Compass }
```

The active item is determined with:

```ts
currentPage === item.page
```

## Adding a page

When adding a top-level page:

1. Add the page name and path to `pageToPath` in `frontend/src/App.tsx`.
2. Add the corresponding `<Route>` in the same file.
3. Add a sidebar item if it should appear in primary navigation.
4. Use `setCurrentPage('YourPageName')` for shell-level navigation.
5. Use query params or route state only for contextual detail state.
6. Update this document, `README.md`, and `AGENTS.md` if the routing contract changes.

## Mental model

React Router owns URL matching. `App.tsx` adds a page-name abstraction on top. Sidebar and shell navigation consume the abstraction. Detail views can still use query strings when the destination needs context.
