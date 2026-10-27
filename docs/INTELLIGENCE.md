# Global Eyelash Market Intelligence MVP

The existing CRM is retained at `/`; the new workspace is `/intelligence` (linked in the CRM header). Reuses Next.js 16, TypeScript, CSS, ExcelJS, PostgreSQL and PGlite; no framework replacement. New database records are separate from legacy CRM records. The legacy CRM still contains its pre-existing fictional demos; they are never imported into intelligence leads or reports.

## Local setup (Node 22.9+; tested Node 24)

```sh
cd /workspace/global-search
npm ci --cache /tmp/baihua-npm
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Open `/intelligence` on your local development server. The example uses persistent PGlite (PostgreSQL WASM), requiring no database credentials or Docker. Change `DESKTOP_DATA_DIR` to an absolute writable directory on other machines. Only one process may own a PGlite directory. To migrate again, stop the server first. Migration is idempotent and does not overwrite records. The app also performs the same migration lazily on its first API request. 17 country scoring scenarios are seeded, explicitly labeled DEMO. No intelligence companies, contacts, observed prices or sales are seeded.

### Environment variables

- `DATABASE_URL`: server-side PostgreSQL connection string. Set for web production; remove `DESKTOP_DATA_DIR` when using it. Never prefix with `NEXT_PUBLIC_`.
- `DESKTOP_DATA_DIR`: absolute persistent local PGlite directory, optional lightweight development alternative to PostgreSQL. Takes precedence over `DATABASE_URL` for compatibility with the existing desktop implementation.
- `SERPAPI_API_KEY`: optional server-side live discovery key used by the existing `/api/search` and `/api/contacts`. Configure securely and restart. A present key is not proof that provider authentication or quota works.
- `TEST_BASE_URL`: browser-test server origin. For `next dev`, use `http://localhost:3001` to match the development origin; Next 16 blocks untrusted development origins.

## What works

- Country directory, search, sorting, add country, selected-country comparison and six-factor score explanation; configured weights persist. Missing inputs lower coverage rather than becoming zero. Higher competitive headroom / safety means less competition / risk. Weighted score is `sum(value*weight)/sum(available weights)`; coverage is available weight / total weight. All supplied market component values are synthetic; no evidence-based ranking is claimed.
- B2B-only customer create/edit, search, country/type filters, sorting, selection and bulk qualification, follow-up dates, public source links and collection times. Customer creation requires company name, country, HTTP(S) website, allowed business type and HTTP(S) source. Company-host normalization deduplicates domains. Imports validate before one atomic database write. Unique domain index prevents concurrent duplicate inserts. Existing CRM is separate.
- CSV/Excel import/export and downloadable CSV template. Columns: `name,country,website,type,email,phone,social,products,brand,source,potential,status,lastContact,nextFollowUp,note`. Allowed types: `Importer`, `Wholesaler`, `Distributor`, `Brand`, `Beauty supplier`. Maximum 1,000 records/import. Existing matching domains are skipped; edit existing records through the editor. CSV supports quoted commas/newlines; exports neutralize spreadsheet formula prefixes. Telephone includes publicly provided WhatsApp, not inferred registration.
- Source-linked product observations, filtering by country/product/date/source, series separated by metric definition and unit, observation details. These are manually entered, unverified public observations; provider connectors do not populate them. Value is not presumed to be sales. Add 2+ comparable observations to see temporal movement.
- Public competitor observation registration: source, checked/recorded date, country, products, channel, price/currency, packaging, promotion. Missing fields remain unknown. Human source verification is required.
- B2B advertising hypothesis briefs; no unsupported budget/CPA estimates. English-default navigation, Chinese navigation and summary report copy. Detailed research and form labels remain English in this MVP.
- Report generation, source-linked companies and manual product/competitor evidence, ranking CSV, printing / browser Save as PDF. This uses a real print stylesheet; Chromium PDF generation is exercised in browser tests. No external PDF service.
- API configuration status (key presence only), source registry, pluggable typed adapter contract and explicit refusal for unavailable connectors. SerpAPI is available in the legacy discovery CRM; UN Comtrade and Google Trends connectors are stubs, not operational.
- Reminder preferences and follow-up dates persist. Scheduler is not deployed: no notifications or weekly jobs are claimed.

## Validation

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Separate isolated test database, stop other next dev instances first:
DESKTOP_DATA_DIR=/tmp/baihua-intelligence-test npm run dev -- --port 3001
# In another terminal:
TEST_BASE_URL=http://localhost:3001 npx playwright test tests/browser/intelligence.spec.ts
```

Lint currently checks new code for unused variables and unreachable statements using Biome, independently of the pinned TypeScript 7. Existing tests also run under `npm test`. Browser tests use `/usr/bin/chromium` per existing Playwright config; install Chromium or adjust executablePath to your browser on another host. Browser fixtures are explicitly synthetic and go only into the separate test database. Do not point them at a real customer database. PDF evidence is written to `/tmp/baihua-intelligence-report.pdf`.

## Deployment

1. Provision PostgreSQL 17 (or compatible supported PostgreSQL) with backups and a private network connection. Supply `DATABASE_URL` through the hosting provider secret store, remove `DESKTOP_DATA_DIR`, and set `SERPAPI_API_KEY` only if live search is required. Never commit `.env.local`.
2. Run `npm ci`, `npm run db:migrate`, checks above and `npm run build`; launch `npm start`. Use Node runtime, not static export or Edge. Migration and deployment must target the same database.
3. Put this single-workspace prototype behind authenticated VPN / SSO reverse proxy and HTTPS before storing real contacts. The inherited application has no login, tenant isolation or role model; it is not suitable for an unprotected public deployment. Configure proxy request size limits and quotas.
4. Back up the database; for local embedded deployments persist the PGlite directory on disk and run a single application process. Do not use ephemeral serverless disk for persistence.
5. Verify representative customer create/edit and report after deployment. PostgreSQL production connectivity and live external APIs have not been verified in this cloud session; PGlite is the validated local backend.

No push, release or deployment is performed by this setup. API providers, scheduler, complete Chinese copy and production authentication are remaining integrations. HS codes require explicit scope mapping; broad cosmetics trade figures must not be treated as eyelash sales. No sales forecast or objective market prediction is claimed.

## Live data connector update

Google Trends / SerpAPI and UN Comtrade public preview now have operational collector code at `POST /api/intelligence/collect`, replacing the original placeholders for these workflows. See [Windows setup and data scope](DATA-SOURCES-WINDOWS.md). The older statements above about unimplemented collectors describe the initial release and are superseded by this section. Actual account verification is still required: no real key was configured in the cloud session, and provider domain access was blocked by cloud networking. Endpoint requests are fixed to approved provider hosts, use verified TLS, and have a 30-second timeout. Cache is 15 minutes, new requests are limited to one per source per 60 seconds. Rate limiting and successful observations persist in PostgreSQL/PGlite; all records are stored atomically. Failed attempts preserve earlier successful timestamps and expose no keys. No scheduler or paid subscription is enabled.
