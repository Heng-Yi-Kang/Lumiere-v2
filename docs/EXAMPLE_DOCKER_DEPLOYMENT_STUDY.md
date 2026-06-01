# Example Docker Deployment Study

This note explains how deployment works in the `example_docker/` template and what has to change when it is used for a real server deployment.

## 1. Deployment shape

The example deployment is a Docker Compose stack with three active services and one optional service:

- `mongodb`: persistent database container
- `api`: Express/TypeScript backend container
- `web`: Next.js frontend container
- `nginx` (commented out): optional reverse proxy for HTTPS production access

The main orchestration lives in [example_docker/docker-compose.yml](/home/arch_Kang/projects/AIClassroom/example_docker/docker-compose.yml). The helper entrypoint for operators is [example_docker/start_docker.sh](/home/arch_Kang/projects/AIClassroom/example_docker/start_docker.sh).

## 2. How the stack is built

Compose builds `api` and `web` from the monorepo root (`context: ..`), not from inside `example_docker/`.

That matters because:

- the Dockerfiles copy `package*.json` from the repo root
- each image copies only its app subtree (`apps/api` or `apps/web`)
- `npm ci --workspace=... --include-workspace-root` is used to install workspace dependencies

Build files:

- API image: [example_docker/Dockerfile.api](/home/arch_Kang/projects/AIClassroom/example_docker/Dockerfile.api)
- Web image: [example_docker/Dockerfile.web](/home/arch_Kang/projects/AIClassroom/example_docker/Dockerfile.web)

Both Dockerfiles use a two-stage build:

1. builder stage installs dependencies and builds the app
2. production stage installs runtime dependencies only, copies build output, creates a non-root user, and starts the app

## 3. Runtime topology

The services communicate over the internal Docker bridge network `ai-classroom-network`.

### MongoDB

- Image: `mongo:7-jammy`
- Data persisted to `./data/mongodb`
- Exposed on host as `127.0.0.1:27017:27017`
- Health check uses `mongosh` ping

The host binding is loopback-only, which means MongoDB is intended to be reachable locally on the server, not publicly exposed.

### API

- Built from `example_docker/Dockerfile.api`
- Exposed on host port `5001`
- Depends on MongoDB health
- Stores uploads in `./data/uploads` mounted to `/app/uploads`
- Logs go to `./logs/api`

The backend connects to MongoDB with:

`mongodb://mongodb:27017/ai-classroom`

That hostname works because Compose creates DNS entries for service names on the internal network.

### Web

- Built from `example_docker/Dockerfile.web`
- Exposed on host port `3000`
- Depends on API health
- Logs go to `./logs/web`

The frontend is not expected to call the backend directly from the browser in production. Instead, it uses a Next.js server-side proxy.

## 4. Why `PUBLIC_API_URL=/api` is important

The deployment template expects the frontend to expose `/api` to the browser and then proxy those requests internally to the backend container.

Relevant code:

- API proxy route: [apps/web/src/app/api/[...path]/route.ts](/home/arch_Kang/projects/AIClassroom/apps/web/src/app/api/[...path]/route.ts)
- Upload proxy route: [apps/web/src/app/uploads/[...path]/route.ts](/home/arch_Kang/projects/AIClassroom/apps/web/src/app/uploads/[...path]/route.ts)

In Compose:

- browser-facing env: `NEXT_PUBLIC_API_BASE_URL=${PUBLIC_API_URL:-http://localhost:5001/api}`
- server-side internal env: `BACKEND_API_URL=http://api:5001/api`

Recommended `.env` setting:

```env
PUBLIC_API_URL=/api
```

Effect:

1. the browser calls the frontend at `/api/...`
2. Next.js receives that request in its route handler
3. the handler forwards the request to `http://api:5001/api/...`
4. the browser never needs direct knowledge of the backend container address

This is the core reason the stack works cleanly behind a reverse proxy and under a single public origin.

## 5. Startup flow

The intended operational command is:

```bash
cd example_docker
./start_docker.sh
```

The script does the following:

1. checks for Docker and `docker compose`
2. checks for `.env`, creating it from `.env.example` if missing
3. creates required data/log directories
4. runs `docker compose build --no-cache`
5. runs `docker compose up -d`
6. waits for services to report healthy or up
7. prints access URLs and container status

The default access points are:

- frontend: `http://localhost:3000`
- API: `http://localhost:5001/api`

## 6. Persistence and state

Persistent state is host-mounted, not stored only in container layers.

Mounted directories:

- `./data/mongodb` -> MongoDB data
- `./data/uploads` -> uploaded files
- `./logs/api`
- `./logs/web`
- `./logs/mongodb`
- `./logs/nginx` when nginx is enabled

This means redeploying containers does not remove database contents or uploaded files unless volumes/directories are explicitly deleted.

## 7. Health checks and dependency order

The stack uses health checks to sequence startup:

- `mongodb` must pass ping before `api` starts
- `api` must pass `GET /api/health` before `web` starts

This is implemented in Compose with `depends_on.condition: service_healthy`.

Operationally, this is one of the stronger parts of the template because it avoids the frontend starting before the backend is responsive.

## 8. Production changes expected by the template

The example is not production-ready as-is. The files themselves make that clear.

### Path fix after copying

The biggest mechanical gotcha is in Compose build paths. If `example_docker/` is copied to another folder such as `production_docker/`, these lines must be updated:

```yaml
dockerfile: example_docker/Dockerfile.api
dockerfile: example_docker/Dockerfile.web
```

They must match the new folder name, for example:

```yaml
dockerfile: production_docker/Dockerfile.api
dockerfile: production_docker/Dockerfile.web
```

If this is missed, `docker compose build` will fail because the Dockerfile path will be wrong.

### Security and infra changes

The template expects these production edits:

- set a strong `JWT_SECRET`
- enable MongoDB authentication
- provide real API credentials in `.env`
- optionally enable resource limits in Compose
- uncomment and configure the `nginx` service for HTTPS
- place SSL certs under `certs/`

The production-oriented guidance is documented in [example_docker/README.md](/home/arch_Kang/projects/AIClassroom/example_docker/README.md) and referenced from [README.md](/home/arch_Kang/projects/AIClassroom/README.md).

## 9. Nginx role in production

`nginx` is optional and commented out in the example Compose file, but it is the intended public entrypoint for a real deployment.

Its role is:

- terminate SSL
- expose `80` and `443`
- forward traffic to `web` and `api`
- centralize upload-size and timeout handling

This is especially relevant because the app supports:

- large file uploads
- long-running AI requests
- streaming-style responses

Without a reverse proxy configured correctly, those workflows are more likely to fail under real traffic.

## 10. What is actually deployed

From the deployment template, the shipped runtime is:

- a compiled Express backend started with `node dist/index.js`
- a built Next.js app started with `npm start`
- a MongoDB container with host-mounted storage

This is a single-server Compose deployment. It is not Kubernetes-oriented and does not include autoscaling, external object storage, managed secrets, or remote database services.

## 11. Strengths of the example

- simple operator workflow
- clean separation between web, API, and DB
- persistent host-mounted storage
- internal service-to-service networking
- health-checked dependency order
- frontend proxy design that avoids exposing container topology to browsers

## 12. Main risks and limitations

- `api` and `web` are published directly on host ports even before nginx is enabled
- MongoDB auth is off by default
- the copied-folder Dockerfile path requirement is easy to miss
- local directory mounts are simple but tie the deployment to one server filesystem
- `.env` carries sensitive secrets and needs server-side handling discipline
- `build --no-cache` on every scripted startup is reliable but slow for normal redeploys

## 13. Practical deployment sequence

Based on the template, the real deployment flow is:

1. copy `example_docker/` to the target server
2. rename it for the environment if desired
3. fix Dockerfile paths inside `docker-compose.yml`
4. create `.env` from `.env.example`
5. set production secrets and API endpoints
6. optionally enable MongoDB auth, nginx, and resource limits
7. provide SSL certs if nginx is enabled
8. run `./start_docker.sh`
9. seed the database if this is a fresh environment
10. verify health endpoints and proxy behavior

## 14. Bottom line

The `example_docker/` setup is a Compose-based single-host deployment template. Its key design decision is that the frontend acts as the browser-facing entrypoint and proxies `/api` and `/uploads` traffic internally to the backend container. MongoDB and uploads are persisted through host-mounted directories, and production hardening is left to explicit follow-up edits in `.env`, Compose, and optional nginx configuration.
