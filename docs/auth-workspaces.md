# Authentication and Workspace Isolation

Lumiere uses first-party email/password authentication with HTTP-only cookie sessions.

## Default admin

The backend ensures the default admin account exists on startup and during admin login:

- Email: `admin@lumiere.my`
- Password: `admin1234`

This fixed password is intended for the current local/demo workflow only.

## Workspace ownership

Notebook, file, note, RAG, and goal APIs require an authenticated session.
Notebook records are owned by `Notebook.userId`, and nested file, note, and RAG routes only operate through notebooks owned by the current user.

Goals are stored server-side per user through `/api/goals`.

## Admin users

Admins can use `/admin` to review account stats and manage users.
The Manage Users tab supports enable/disable actions and role changes.
Disabling a user immediately deletes that user's active sessions.
Admins cannot disable their own account, change their own role, or remove the last active admin.

## Legacy cleanup after migration

The auth migration deletes legacy notebook rows from PostgreSQL before adding required user ownership.
After applying the migration in an existing local environment, manually remove stale non-database artifacts:

1. Delete legacy uploads under `backend/public/uploads/notebooks/*`.
2. Clear or recreate the configured Qdrant collection, usually `notebook_chunks`.

These artifacts are no longer reachable through authenticated APIs once the database rows are deleted, but cleanup avoids stale storage and vectors.
