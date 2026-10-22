# Phase 6 Load-Test Infrastructure — Drandee Backend

## Overview

These Artillery test scripts measure backend performance under safe,
controlled load. They are designed for **LOCAL and STAGING environments only**.
Never point them at production without a written runbook and team sign-off.

---

## Prerequisites

```bash
# Install from repo root
npm install           # also installs Artillery (devDependency)

# Or globally (for CLI use anywhere)
npm install -g artillery
```

---

## Environment Variables

All sensitive values are read from environment variables.
**Never hard-code tokens or secrets in these files.**

| Variable | Description | Example |
|---|---|---|
| `LOAD_TEST_BASE_URL` | API base URL | `http://localhost:5000` |
| `LOAD_TEST_AUTH_TOKEN` | Valid Firebase-issued JWT (staging user) | (from staging Firebase) |
| `LOAD_TEST_POST_ID` | A real post ID in the staging DB | `123` |

Create a local `.env.loadtest` file (gitignored):

```bash
export LOAD_TEST_BASE_URL=http://localhost:5000
export LOAD_TEST_AUTH_TOKEN=Bearer_xxxxxxx
export LOAD_TEST_POST_ID=1
```

Source it before running:
```bash
source .env.loadtest          # Linux / macOS
# Windows PowerShell:
# $env:LOAD_TEST_BASE_URL="http://localhost:5000"
# $env:LOAD_TEST_AUTH_TOKEN="Bearer_xxxxxxx"
# $env:LOAD_TEST_POST_ID="1"
```

---

## Test Files

| File | Endpoint | Purpose |
|---|---|---|
| `feed.yml` | `GET /api/feed` | Feed ranking throughput |
| `events.yml` | `POST /api/events` | High-volume event ingestion |
| `health.yml` | `GET /api/health/*` | Health check overhead |

---

## Levels Explained

Each YAML defines **three separate phases** — run only the level you need:

| Level | Users | Duration | Purpose |
|---|---|---|---|
| **Smoke** | 1–2 VU | 30 s | Verify connectivity; catch obvious errors |
| **Load** | 10–30 VU | 2 min | Realistic sustained traffic |
| **Stress** | 50–100 VU | 3 min | Upper bound before degradation; USE CAREFULLY |

> ⚠️ **Stress tests should only be run against a dedicated staging environment
> that can be reset. Never use Stress against a shared or production DB.**

---

## Running Tests

### Smoke only (safest — run first)
```bash
# Feed smoke
artillery run load-tests/feed.yml --target "$LOAD_TEST_BASE_URL" -e smoke

# Events smoke
artillery run load-tests/events.yml --target "$LOAD_TEST_BASE_URL" -e smoke

# Health smoke
artillery run load-tests/health.yml --target "$LOAD_TEST_BASE_URL" -e smoke
```

### Full load run with report
```bash
artillery run load-tests/feed.yml \
  --target "$LOAD_TEST_BASE_URL" \
  -e load \
  --output reports/feed_load_$(date +%Y%m%d_%H%M%S).json

# Convert to HTML
artillery report reports/feed_load_*.json
```

### Stress (STAGING ONLY)
```bash
artillery run load-tests/feed.yml --target "$LOAD_TEST_BASE_URL" -e stress
```

---

## Metrics Captured

- Requests/sec (rps)
- Concurrent virtual users (VU)
- Response time: p50, p95, p99 (ms)
- Error rate (%)
- HTTP 4xx / 5xx counts
- HTTP 429 (rate limit hits)
- Session timeout rate

---

## Safety Rules

1. **Always start with smoke before load or stress.**
2. **Never run against `DATABASE_URL` pointing at production.**
3. **The `events.yml` POST test sends well-formed but synthetic post IDs** — they will fail DB FK checks gracefully and return 4xx, which is expected.
4. **No admin / destructive operations are triggered.** Tests only call safe GET / analytics POST endpoints.
5. **Rate limiting is intentionally tested** — 429 responses are expected and tracked, not treated as failures.

---

## Interpreting Results

| Metric | Healthy Target | Investigate If |
|---|---|---|
| p99 latency `/api/feed` | < 800 ms | > 1500 ms |
| p99 latency `/api/events` | < 200 ms | > 500 ms |
| p99 latency `/api/health` | < 50 ms | > 200 ms |
| Error rate | < 1% | > 2% |
| HTTP 5xx | 0 | > 0 sustained |

---

## Reports Directory

```
load-tests/
  feed.yml
  events.yml
  health.yml
  README.md
  reports/           ← gitignored; Artillery JSON + HTML outputs go here
```

Add to `.gitignore`:
```
load-tests/reports/
.env.loadtest
```
