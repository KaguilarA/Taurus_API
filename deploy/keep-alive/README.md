# Backend health schedule

The free Cloudflare Worker `taurus-backend-health` calls the backend's public
`/api/health` every ten minutes, independently of GitHub Actions schedules.
It has no database access, credentials, public trigger endpoint, or customer data.
A provider HTML challenge, HTTP error, invalid JSON, or `ok: false` fails the
scheduled event so Cloudflare records the failure instead of a false success.
The network deadline includes the response body. Logs contain only health and
duration, and no request or response payloads.

The source and schedule are in this folder. The initial deployment was made
through the existing Cloudflare dashboard session. Keep dashboard code and
`wrangler.jsonc` synchronized when making changes. This is a separate
infrastructure Worker, not the Pages gateway or a second application backend.

Cloudflare cron configuration can take up to fifteen minutes to propagate.
Inspect actual scheduled invocations in Workers Observability; a manual preview
alone does not prove that the automatic schedule is firing.

GitHub's existing workflow remains available for manual diagnostics and Render
redeploy recovery. Neither health pings nor redeploys remove Render Free's quota,
provider security challenges, or unplanned restarts. Continuous availability is
not guaranteed by this free hosting arrangement.
