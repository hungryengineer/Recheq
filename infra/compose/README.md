# Local Infrastructure Setup

## Services

- **PostgreSQL 16** — Primary datastore (port 5432)
- **MinIO** — S3-compatible object storage (port 9000, console 9001)
- **Mailpit** — SMTP + web UI for testing (port 1025 SMTP, 8025 web)

## Start

```bash
docker compose up -d
```

## Health Check

```bash
docker compose ps
```

All services should show `healthy` status.

## Stop

```bash
docker compose down
```

## Reset (remove volumes)

```bash
docker compose down -v
```

## Access

| Service        | URL                                                                      |
| -------------- | ------------------------------------------------------------------------ |
| PostgreSQL     | localhost:5432 (psql postgres://postgres:postgres@localhost:5432/recheq) |
| MinIO Console  | http://localhost:9001 (user: minioadmin / pass: minioadmin)              |
| Mailpit Web UI | http://localhost:8025                                                    |

## Environment Variables

See `.env.example` for required variables.

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/recheq
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY_ID=minioadmin
S3_SECRET_ACCESS_KEY=minioadmin
SMTP_HOST=localhost
SMTP_PORT=1025
```
