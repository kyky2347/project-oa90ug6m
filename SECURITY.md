# Security

PULSE currently supports the latest v0.1.x code line. This local-first release does not claim a completed external security audit.

## Reporting a vulnerability

Use [GitHub private vulnerability reporting](https://github.com/kyky2347/project-oa90ug6m/security/advisories/new) for security-sensitive findings. Include the affected revision, reproduction steps, impact and a minimal example with secrets removed. Avoid publishing exploitable details in a public issue before the finding can be assessed. No response-time commitment is implied.

## Deployment boundaries

Default Compose ports bind to loopback. The supplied database password is a local development default. Administrative API endpoints are disabled while `ADMIN_TOKEN` is empty. Configure secrets, authenticated administration, TLS, ingress controls, backups and monitoring before exposing a deployment.

Keep `.env`, downloaded raw data and backups out of Git. Do not expose PostGIS or Redis directly to the internet. Public-source records, derived databases and copied datasets remain subject to their publisher terms. See [deployment](docs/deployment.md) and [data licences](docs/data-licenses.md).
