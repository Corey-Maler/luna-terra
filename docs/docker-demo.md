# Run the interactive docs and Node renderer in Docker

The `demo` image serves the built React docs and a Ground Crew worker service from one Node process on port 4200. Browser charts remain interactive; the **Server rendering → Try the server renderer** section posts the same chart specification to `/api/v1/render` and shows the returned PNG. The standalone renderer port is not exposed. The lab `compose.yaml` targets Linux: the app uses host networking to preserve the Caddy peer IP through proxy checks.

Compose also starts Redis with a named volume and AOF persistence. The default quota is **10 render attempts per client IP per 10 minutes**, shared by both render endpoints. Windows begin with the client's first request and reset after ten minutes; this is a fixed-window quota, not a rolling ten-minute window. Invalid rendering requests also consume quota. Browsing the docs, editing the chart, and downloading an already-generated image do not consume requests.

```sh
# From the repository root:
docker compose up -d --build --wait
docker compose logs -f demo
```

Open `http://localhost:4200/ground-crew/overview`. Defaults bind to loopback; use `DEMO_BIND_HOST=0.0.0.0` when a Caddy container must reach the host port.

## Public deployment on Coolify

Use `compose.coolify.yaml` as a standalone definition. It uses container networking, exposes the app internally on 4200, and keeps Redis private. Coolify connects Traefik to the app network. Neither service publishes a host port. See [Coolify networking](https://coolify.io/docs/core/networking-in-coolify).

In your Git-backed Coolify application:

1. Choose the **Docker Compose** build pack, with the repository root as Base Directory.
2. Set **Docker Compose Location** to `/compose.coolify.yaml`.
3. Use normal Compose deployment, with **Raw Compose Deployment** disabled.
4. Under **Domains for demo**, enter your public HTTPS domain with `:4200` appended. The suffix selects the internal container port; visitors use normal HTTPS. Keep Redis's domain empty.
5. Set `DEMO_RATE_LIMIT=10` and `DEMO_RATE_WINDOW_MS=600000` in Coolify's environment variables, then deploy the branch containing these changes.

Coolify manages the domain route and TLS certificate. These settings follow its [Compose deployment guide](https://coolify.io/docs/applications/builds/docker-compose). Configure the hostname in Coolify; it is not baked into the image or Compose file. The lab `.env` is ignored and does not travel with Git or the Docker build.

The public definition sets `DEMO_TRUST_PROXY=1` for this path:

```text
Visitor → Coolify Traefik (HTTPS) → demo:4200 → Redis
```

This trusts exactly one hop and reads the nearest forwarded client address, so adding fake addresses to the left of the header does not change the quota key. It also avoids depending on a changing Traefik container IP. This mode requires the backend to have no direct public ingress and Traefik to be the direct edge proxy. The Compose file enforces the first condition by omitting host port mappings. If you add another edge proxy or CDN, configure that proxy chain explicitly before relying on per-visitor quotas; see [Express proxy handling](https://expressjs.com/en/guide/behind-proxies/).

After deployment, check `/api/config` reports 10 and 600, then render from the server-preview docs page. The eleventh render attempt within a quota window should return 429; another client IP should still have its own quota. Actual TLS routing and visitor-IP handling must be checked on the Coolify server.

## Local configuration

Compose reads `.env` in the repository root. It is ignored by Git and excluded from the image build context. `.env.example` contains public defaults.

```dotenv
DEMO_BIND_HOST=0.0.0.0
DEMO_PORT=4200
DEMO_RATE_LIMIT=1000
DEMO_RATE_WINDOW_MS=600000
# Fill with your Caddy container's exact source IP or controlled proxy subnet:
DEMO_TRUST_PROXY=
```

The local development override raises the limit for everyone using that deployment. Omit it or set `DEMO_RATE_LIMIT=10` when deploying the public quota. The UI reads the actual configured limit from `/api/config`; no hostnames or quotas are embedded at build time. Runtime changes require `docker compose up -d` to recreate the app container. `docker compose restart` alone does not reload changed environment settings.

| Variable | Default | Meaning |
| --- | --- | --- |
| `DEMO_PORT` | `4200` | App listening port in the host network |
| `DEMO_BIND_HOST` | `127.0.0.1` | Host interface for the published port |
| `DEMO_REDIS_PORT` | `6387` | Redis port published on host loopback only |
| `DEMO_RATE_LIMIT` | `10` | Allowed requests in each quota window |
| `DEMO_RATE_WINDOW_MS` | `600000` | Window length in milliseconds |
| `DEMO_TRUST_PROXY` | empty | Comma-separated proxy IPs/CIDRs; empty ignores forwarded headers; `1` trusts one direct edge proxy |
| `DEMO_RENDER_WORKERS` | `2` | Concurrent render workers |
| `DEMO_RENDER_QUEUE` | `16` | Waiting render jobs |
| `DEMO_RENDER_TIMEOUT_MS` | `10000` | Job deadline including queue time |

## Caddy and visitor addresses

Keep Caddy proxying to the host on port 4200. It forwards `/api` and docs paths through the same upstream. No separate public renderer route or CORS configuration is needed.

Set `DEMO_TRUST_PROXY` to the actual Caddy source address seen by the application. Inspect the Caddy container with `docker inspect`. The app uses [Linux host networking](https://docs.docker.com/engine/network/drivers/host/) so a Docker port-forwarding gateway cannot hide the peer's identity. Do not replace this with a publicly published bridge port and blindly trust its gateway: direct clients may then be able to spoof forwarding headers. Prefer a stable assigned proxy IP or a dedicated, controlled proxy subnet. Do not trust every forwarded header or every private network. [Express resolves client IPs through explicitly trusted proxies](https://expressjs.com/en/guide/behind-proxies/), taking the nearest untrusted address and ignoring attacker-supplied addresses farther left in the chain.

The app ignores `X-Forwarded-For` from untrusted connections. If Caddy is not trusted, visitors through it share the proxy's quota. IPv4 clients are limited individually; IPv6 clients are grouped by /56 to prevent quota evasion by rotating addresses within a delegated range.

## Quota storage and failures

Redis increments counters atomically across concurrent requests. AOF uses `appendfsync always`; recreating the app or restarting Redis preserves counters in the named volume. Entries expire automatically. Redis is private in Coolify and published only on host loopback in the lab. It uses a 64 MiB key-memory limit and `noeviction` so memory pressure cannot silently reset quotas. Redis unavailability stops new previews with 503 while docs remain available. Responses blocked by quota return 429, `Retry-After`, and rate-limit headers. The UI shows the retry countdown.

The app runs as a non-root user with a read-only filesystem, limited memory/CPU, and a writable temporary directory. Output allocation, request body size, worker concurrency, queue length, and render deadlines are bounded independently of the per-IP quota. Full readiness is reported by `/readyz` and checked by Docker.

Redis is the Compose default. For a temporary single-process run without persistence:

```sh
pnpm build
DEMO_RATE_STORE=memory DEMO_PORT=4202 pnpm --filter @lunaterra/demo start
```

In-memory counters reset with the process and are not shared across replicas. [The limiter configuration](https://express-rate-limit.mintlify.app/reference/configuration) and [Redis store](https://github.com/express-rate-limit/rate-limit-redis) describe these behaviors.

## Update or stop

```sh
docker compose up -d --build --wait   # rebuild docs and renderer, then recreate
# Data remains in the named Redis volume:
docker compose down
```

Avoid `down -v` if you want to keep active quotas. To rehearse a replacement while an existing Vite server occupies 4200, run `DEMO_PORT=4202 docker compose up -d --build --wait`, check docs, previews, and headers, then stop only that Vite process and run `docker compose up -d --wait` on the configured 4200 port.

## Grant local Docker access

```sh
sudo bash scripts/grant-docker-access.sh
# Explicit account, if needed:
sudo bash scripts/grant-docker-access.sh agent01
```

This adds the selected account to the Docker group and verifies daemon access in a fresh process. Docker group access grants administrative control of the machine. Existing sessions may use `sg docker -c 'docker compose ps'`; new login sessions receive the group automatically. The script does not restart Docker or existing containers.
