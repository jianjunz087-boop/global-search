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

## 1.0.2 public WhatsApp lookup

Open an unverified real customer's details and choose **Find public WhatsApp / 查找公开 WhatsApp**. Each click uses one SerpAPI Google search restricted to the exact website domain. Only indexed official-page snippets explicitly labeling an international WhatsApp number or containing a `wa.me` / `api.whatsapp.com` number are accepted. Ordinary telephone numbers and other domains are ignored. The app does not crawl the website, bypass restrictions, infer account registration or send messages. A public number still requires ownership verification and permitted outreach.

A successful lookup stores `whatsapp` and `whatsappSource` in the existing JSONB record while preserving CRM fields. The source is clickable in customer details and included in Excel exports. An empty lookup leaves previously saved contact information intact and explains that absence from search results does not prove absence of WhatsApp. Search uses the customer's own API quota; no provider credentials are included in the installer. Live account verification is not claimed by fixture tests.

The darker search page also displays the exact 250-country/territory total, offers a Show all action to clear country lookup text, and displays the app version in its footer.

## 1.0.3 pagination and installed-application validation

Real discovery now uses provider pagination (`start=(page-1)*10`) and enables Next only when SerpAPI returns a next-page link. Previous/Next retain the submitted keyword, country and business type; editing an input does not silently change a page request. Each page request uses account quota. Demo and CRM lists paginate locally, ten rows per page; selection applies to the visible page, and an unselected Excel export includes all filtered stored records.

The country selector always contains all 250 countries and territories plus All countries. A separate browsable directory filters names in Chinese, English or by code. The whole workspace now uses dark green surfaces, with a prominent version marker and release banner. The WhatsApp column offers lookup directly in the list, distinguishes unchecked records and checked records with no public number, and links to the number's official source. Primary organic-result snippets can also supply explicitly labeled international WhatsApp numbers.

The legacy local 1.0.0 installer streaming path has been removed. The in-app download page redirects to the live public download page. Windows release CI now runs the actual NSIS installer and launches its installed executable to check version, computed theme color, all 250 countries, local pagination, CRM persistence, and synthetic public-contact UI handling before publishing. This verifies packaging, not live SerpAPI account access.

## Global Eyelash Market Intelligence MVP

Open `/intelligence` for the new market research workspace. See [setup, environment variables, validation and deployment](docs/INTELLIGENCE.md). The existing CRM remains available at `/`.

### Configure live sources on Windows

Double-click `CONFIGURE-API.bat`, set `SERPAPI_API_KEY` in your private `.env.local`, save and restart `START-WINDOWS.bat`. Then use **Data Sources → Collect real data** for Google Trends search-interest indices or broad-category UN Comtrade context. See [中文配置步骤与数据口径](docs/DATA-SOURCES-WINDOWS.md). A present key is not verified access; no real sales or market totals are inferred. Live provider verification remains pending until a successful local request.

## Google/Yandex B2B and public-contact upgrade

The existing root discovery page now includes Google/Yandex parallel search, durable task/cache/error traces, source-aware deduplication, public WhatsApp/contact research, manual ownership review, B2B evidence scoring, company dossiers, country trade context and richer CSV/Excel exports. Original CRM records and APIs remain compatible. Read [upgrade, schema migration, API setup and deployment limitations](docs/B2B-UPGRADE.md) before upgrading a real customer database. Windows startup refreshes dependencies when the lockfile changes; it does not reset data. Real account access is verified only after a successful query with your local/server key.
