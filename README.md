# BAIHUA AI TRADE
Bilingual Next.js + PostgreSQL prospecting CRM for Chinese eyelash manufacturers.

## Local development
Requires Node.js 22+ and Docker (or an existing PostgreSQL 17 server).

```sh
npm ci --cache /tmp/baihua-npm
docker run -d --name baihua-postgres -e POSTGRES_USER=baihua -e POSTGRES_PASSWORD=baihua_local_dev -e POSTGRES_DB=baihua -p 127.0.0.1:5432:5432 postgres:17-alpine
cp .env.example .env.local
# Set DATABASE_URL for your database; demo local container uses:
# postgresql://baihua:baihua_local_dev@127.0.0.1:5432/baihua
npm run dev
```
The first API request transactionally creates tables and seeds 16 clearly labeled fictional customers. CRM edits persist in PostgreSQL. For persistent container recreation, mount a Docker volume at /var/lib/postgresql/data. The bundled local credentials are development-only; use secure credentials and authentication before deployment.

## Validation
`npm test`, `npm run typecheck`, `npm run build`. `npx playwright test` runs browser tests against a running local server (install Chromium first with `npx playwright install chromium`).

## Features and boundaries
Search simulated leads by keyword, country and business type; sort and filter by score; inspect transparent score components; deduplicate normalized domains; select and export Excel; update CRM status, notes and follow-up date; generate editable English, Chinese, Russian and Spanish introduction templates; switch main interface language.

This release is demo-only. Reserved `.example` domains are intentionally non-deliverable. No real customer data, WhatsApp numbers, real search results or live AI output are fabricated. Scores are illustrative. No message sending feature exists.

`POST /api/search` uses SerpAPI Google organic results; without SERPAPI_API_KEY it returns HTTP 503. Use the SerpAPI search button with a keyword. Public snippets are the only email extraction source; missing contacts stay empty. Domains are deduplicated at insertion and CRM fields are preserved. Results are unverified and never assigned fabricated AI scores. A later integration must validate provider terms, public sources, robots restrictions, personal-data obligations, source URLs and collection timestamps, with rate limiting and manual review. Do not bypass access restrictions or send unsolicited bulk WhatsApp messages. SerpAPI credentials are required to verify live requests; this release does not claim live verification.

No login or multi-tenant access control is included: do not expose this prototype with real customer information on a public server.

## Windows desktop (x64)

`npm run desktop:build` creates an NSIS Windows 10/11 x64 installer in `dist/windows/`. Linux builders can use writable ELECTRON_CACHE and ELECTRON_BUILDER_CACHE directories. The installer includes Electron, the standalone Next.js server and PGlite (embedded PostgreSQL WASM); no external Node.js, Docker or database installation is required for the desktop demo. The web deployment continues to use PostgreSQL via DATABASE_URL.

Local data stays under the current Windows user's application-data directory, in `postgres-data`. Uninstallation retains data. Open the application menu to view the data directory or configure a SerpAPI key. The key is encrypted using Electron safeStorage (Windows DPAPI); never bundle a key. Search still requires Internet access and a valid SerpAPI account. Website/email contacts are not invented. The installer is unsigned; Windows may display an unknown-publisher warning. Only Linux service/browser checks have been executed; Windows installation and launch require a Windows acceptance check.

Build preparation explicitly strips `.env*` files from the shipped server. No cloud database credentials are included. Keep `dist/` and secrets out of source control.

## Download page

`/download` serves the bilingual desktop download page. The local server streams an existing installer through `/api/download/windows` with attachment headers, and `?checksum=1` provides a computed SHA-256 file. Override DESKTOP_INSTALLER_PATH only with a server-managed path; request parameters cannot choose filesystem paths. Installers are excluded from Next.js dependency tracing.

`docs/index.html` is also a self-contained static GitHub Pages download page. It checks public GitHub Releases and enables download only when a published release contains the Windows installer. Enable Settings → Pages → Build and deployment → Source: GitHub Actions once as repository administrator, then run the Publish download page workflow. The cloud session cannot enable this administrator setting with its current credentials. Publishing the page does not itself publish an installer.

## 1.0.1 search update

The main search button now performs real SerpAPI search by default. Choose Demo data explicitly to filter the 16 simulated records. The target selector contains 250 countries and territories (ISO regions plus supplementary Kosovo) with Chinese, English and ISO-code lookup. Empty keywords default to eyelashes; common Chinese eyelash terms are normalized to English. Buyer categories use an OR query and optional business-type targeting. Country is a search target, not a verified company location.

Search results are deduplicated by domain, retain prior CRM notes and are not hidden by illustrative score filters. Missing credentials, rejected keys, quota limits, timeouts and database failures have distinct persistent messages. The desktop Search settings button opens encrypted-key configuration; no key is bundled. A configured key is not proof of access until a provider request succeeds. Live provider verification requires the user's own SerpAPI credentials and remaining quota. Unit tests use explicit synthetic fixtures, not real customer claims.
