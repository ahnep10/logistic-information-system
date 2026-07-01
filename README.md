# Logistics MIS

A web-based Management Information System for B2B distribution, covering procurement, warehouse operations, and management reporting.

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local PostgreSQL database)
- Node.js 20+

## Database Setup

The project uses PostgreSQL 16 running in Docker.

**Start the database:**
```bash
docker compose up -d
```

**Stop the database (data is preserved):**
```bash
docker compose down
```

**Reset all data (destructive — drops the volume):**
```bash
docker compose down -v
```

## Environment Variables

Copy `.env.example` to `.env` and fill in any values specific to your environment:

```bash
cp .env.example .env
```

The default `.env.example` is pre-configured for the Docker setup above and works without changes for local development.
