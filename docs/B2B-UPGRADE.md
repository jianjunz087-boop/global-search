# BAIHUA SHIJIE EYELASH · B2B discovery upgrade

This is an additive upgrade of the existing Next.js 16 + TypeScript + PostgreSQL/PGlite application. Existing `/`, `/intelligence`, Google API compatibility, CRM status/notes/follow-up, demo switch, Excel export, outreach templates, Windows portable startup and desktop build source remain available. No database reset, destructive migration or credential replacement is required. The versioned desktop installer has not been rebuilt or tested on Windows by this cloud session; the downloadable source web application is the upgraded deliverable.

## Start / update safely

1. Stop the existing application before copying files or backing up PGlite. Back up `%LOCALAPPDATA%\BaihuaIntelligence` and your private `.env.local`; use a proper PostgreSQL backup for a server database.
2. Extract the updated source to a separate directory, keep the full portable `node-v24...-win-x64` runtime next to `START-WINDOWS.bat`, and copy your private `.env.local` to the new directory without sharing it. Windows startup continues using the same user data path. Do not place the portable runtime inside the project's `node_modules`.
3. Double-click `START-WINDOWS.bat`. It compares the lockfile fingerprint and uses frozen `npm ci` only when needed; this updates the newly added dependencies without resetting data. Then it runs the additive migration and starts the app. Keep the command window open.
4. Open the root page `/` for the upgraded B2B discovery UI. `/intelligence` remains the market-research workspace. New controls are under **Search engines & public-source discovery**; new dossier fields are inside **Multi-platform contacts, evidence & import analysis** in the existing sidebar.

CLI (Node 22.9+ / tested Node 24):

```sh
npm ci
# Preserve an existing .env.local. New users may copy .env.example and set their database path.
npm run db:migrate
npm run dev
```

The migration now closes its database cleanly before exit. Do not run it concurrently with the server on the same embedded data directory.

## API configuration / costs

- `SERPAPI_API_KEY`: existing SerpAPI credential, reused for Google, Yandex and Trends. Get/manage your key and plan at https://serpapi.com/manage-api-key. Confirm current pricing and engine entitlement with the provider; this app does not purchase a subscription.
- `YANDEX_SERPAPI_KEY`: optional separate **SerpAPI** credential for Yandex. Leave empty to reuse `SERPAPI_API_KEY`. `CONFIGURE-API.bat` adds missing empty variable lines and opens the local private file without printing existing values. Save and restart the server.
- `YANDEX_API_KEY`: intentionally **not used**. The chosen legally authorized adapter is SerpAPI's documented Yandex engine (`engine=yandex`, search term `text`, page `p`, optional `lr`). Direct Yandex Cloud API would require a separate authorized implementation/IAM and billing; it is not falsely shown as configured.
- `UN_COMTRADE_API_KEY`: not used for the selected official public preview. ITC Trade Map, premium Comtrade and company-level customs providers require separate authorization/adapters; none is presumed active from an arbitrary key.
- `DATABASE_URL`: external PostgreSQL. Remove `DESKTOP_DATA_DIR` when selecting it.
- `DESKTOP_DATA_DIR`: persistent embedded PGlite alternative. Windows launcher uses the existing `%LOCALAPPDATA%\BaihuaIntelligence` path. A cloud `.env.example` path must be changed on another machine if not using the launcher.

All credentials are server-only; configuration endpoints return presence/status, never values. Do not paste credentials into chat. A present key is not proof of engine access or quota.

Both engines run in parallel within a task. Each uncached engine request can consume account quota; HTTP 5xx gets at most one retry. Auth failures, quota errors and ambiguous network timeouts are not automatically retried. Displayed usage is HTTP requests **attempted**, not verified provider billing or remaining credits. Successful per-engine results cache for 15 minutes, including empty successful results. Each engine has a persistent two-second new-request guard. A provider can return fewer than the selected 1–20 result cap. Google offsets use the selected limit; Yandex pages use its provider page numbering and are not expanded into undisclosed extra requests.

## Discovery / source truth

English, Russian, Polish and Turkish buyer-oriented query suggestions are generated locally; custom keywords remain editable. Country and language settings are search targets, never verified company location. Public Instagram, Telegram and Facebook results come from authorized search indices; no login, private-account access, private Telegram enumeration or contact-button API permission is assumed.

Search observations preserve engine, exact query, original URL, public title/snippet, target country, platform and retrieval time. A search title is not asserted to be a legal company name. Clear personal-consumer signals can be excluded and operators can mark a record as personal/non-B2B. Other uncertain candidates remain labeled unqualified; use **B2B signals** to view only candidates with indexed or reviewed business evidence. Cities and confirmed websites filter operator-reviewed fields only.

Obvious directories, top-N supplier articles, Facebook groups and private invite resources are stored separately as research resources in task details, not silently created as company prospects. Heuristic classification is conservative and requires operator review. Existing historical rows are never deleted; an old directory record needs an operator-confirmed real website before deeper contact research.

Company deduplication normalizes owned domains and platform account identities, preserving different accounts on the same platform. Manually reviewed official websites/social identities can act as company aliases. Ambiguous cross-platform matches require the dossier merge action, which explains the operation before applying it. The original row becomes an archived alias, all source/contact/history rows move to the target, and both original CRM/profile snapshots remain in the audit history. Existing notes, statuses, custom JSON fields and follow-up dates are not overwritten by later search results. Contact evidence is deduplicated for display while retaining every source and underlying evidence ID.

## WhatsApp / contact enrichment

- Explicit `wa.me/<number>`, `api.whatsapp.com/send?phone=...`, official `wa.me/message/...` business links and nearby explicit WhatsApp number labels are recognized. Email, ordinary `tel:`/phone labels and public Instagram/Telegram/Facebook/website URLs are extracted separately.
- Number normalization uses international numbering-plan metadata. “Format valid” means a **possible** country-code/length format, not allocation, ownership, account registration or deliverability. International `+`/`00` numbers are accepted; national format needs an independently operator-reviewed country. The search target is never used to guess a private number.
- Related pages produce ownership-unverified candidates. An unrelated page's number is not automatically attached as the company's confirmed WhatsApp, and no direct number link is generated until appropriate association/manual review exists.
- States are separate: number/link found, format valid/unresolved, ownership unverified/manually confirmed, and account availability **not checked**. Ordinary phones stay “WhatsApp unconfirmed”. Manual ownership review requires reviewer and reasoning; no function falsely claims official WhatsApp registration verification.
- Existing stored WhatsApp values remain intact on empty or failed enrichment; failed lookups keep a separate attempt/error state rather than becoming a false “no number found” or stamping a successful check. Legacy evidence is additively backfilled for manual review, with unknown collection time when unavailable.
- Optional public website fetching requires an explicit operator declaration that the selected site is the company site and access is permitted. It checks robots, crawl delay, HTTP status/content type, size, HTTPS/TLS, DNS/public addresses, same-origin redirects and common access-challenge markers. At most four content pages (root and linked Contact/About/Wholesale) are visited, plus robots/limited redirects. No restriction is bypassed. Social platforms remain index-only. Pinned DNS prevents private-address/rebinding access; when a managed proxy is present, direct pinned fetching is declined and the task reports indexed-only limitations. Larger crawl delays/blocked robots require a separate permitted workflow, not a bypass.

The first-message draft is a locally generated, editable opt-in-oriented B2B template, never a live AI output or automatic sending function. Confirm language and permitted contact before outreach.

## Analysis / scoring

Six configurable weights total 100: product 25, business 20, WhatsApp 20, OEM 15, activity/scale 10, company import records 10. Missing evidence earns zero and reduces coverage; the model does **not** renormalize missing evidence to inflate scores. Indexed keyword claims earn at most 60% of a component, operator-reviewed source/quote facts can earn the full component. Public valid-format WhatsApp contributes 80%, reviewed ownership 100%; official business-link-only evidence contributes 60%. None of these prove WhatsApp account availability. No source-backed activity or company import record means zero for those components.

A ≥80, B ≥60, C ≥40, D <40. Scores, contact completeness and priority are transparent triage rules, not purchase probabilities, objective sales estimates or claims that a company imports. Coverage is evidence availability, not statistical confidence. Company location, DIY/kit sales, importer/brand status, size, buying needs and budget stay unknown or explicitly inferred unless reviewed public evidence is attached. Facts, inferences and unknowns appear separately.

## Trade scope

The dossier can request 3 or 5 completed years from UN Comtrade public preview in a single scoped request, read available quantity/unit/estimate flags, calculate adjacent-year growth only with a positive base and matching known HS revision, and fetch a separately labeled returned-partner sample. Requests cache for 24 hours with a 60-second new-request guard. Public preview is limited to 500 rows; missing years/quantities remain unknown and partner samples do not establish a complete supplier ranking.

HS 670419/670420/670490 are **candidate broad hair-article headings, pending classification verification**. Returned official descriptions, revision and limitations control interpretation. DIY clusters may not be separately identifiable; human/synthetic material matters. Glue, Bond & Seal, remover, tweezers, brushes and mixed kits cannot reuse these codes automatically; those queries are disabled in that product selection. There is no eyelash-specific market-size estimate or model-generated company import value.

Company-level amounts/volumes display only in a distinct operator-reviewed public/licensed document register requiring a company identifier match, source, provider, period, HS/description/scope, currency or quantity/unit, reviewer and confirmation. National totals never populate company-import fields or earn import score points. The app does not independently authenticate operator-uploaded assertions; paid company-import APIs remain unconfigured until a separately authorized adapter exists.

## Additive schema / fields

The existing `leads(id text, data jsonb)` and `app_meta` are retained. No columns or existing records are dropped. Optional lead JSON fields are `targetCountry`, `mergedInto`, `mergedAt`, `lastEnrichmentAt`, `whatsappAttemptedAt`, `whatsappLookupStatus`, `whatsappLookupError`; the computed `intel` response is not stored as a replacement for CRM JSON.

New idempotent tables:

| Table | Purpose |
| --- | --- |
| `discovery_tasks` | queued/running/succeeded/partial/failed/cancelled/interrupted task, query/filters, engine errors, attempts and result IDs |
| `discovery_sources` | source engine/query/URL/snippet/retrieval time per company |
| `discovery_contacts` | contact format, association, source, availability status and manual review |
| `discovery_profiles` | operator-reviewed identity, source-backed claims and company-linked trade documents |
| `discovery_history` | append-only search/enrichment/review/merge/import events and prior CRM snapshots |
| `discovery_cache` | per-engine response and trade-window cache with expiry |
| `discovery_limits` | persistent request guards |
| `discovery_settings` | scoring weights and saved query/filter setup |
| `discovery_resources` | indexed directories/groups/research resources kept outside company leads |

The earlier intelligence tables and public collector records remain untouched. Migrations use `CREATE TABLE IF NOT EXISTS`; upgrade regression tests compare historical raw JSON before/after migration and rediscovery. Company merging archives the source; it does not delete records. A UI undo for merge is not implemented, so inspect the identities first.

## Import / export / task execution

CSV/XLSX imports accept at most 500 rows / 5 MB. Template fields: `name,website,source,type,country,email,whatsapp,phone,note,status,nextFollowUp`. Known B2B roles or explicitly unverified B2B candidates are accepted, personal-consumer roles rejected. Source and website are mandatory. All rows validate before an atomic transaction. Domain duplicates append provenance without overwriting existing CRM fields. Imported statements do not become independently verified facts or WhatsApp registrations. Basic exported CRM columns can be reimported; verification assertions require review rather than blindly trusting a file.

CSV/XLSX evidence exports retain contact states and sources, score/coverage/components, facts/inferences, company trade-document sources and CRM fields. Formula prefixes are neutralized. Audit display/export is bounded to the latest 200 selected events; the underlying audit table and original source records remain stored. Use proper database backups for a complete history/archive.

The persistent queue is **application-local**. It runs while the Next Node server is active; status polling also resumes queued work. Queued work can be cancelled. Stale running work becomes interrupted rather than being silently reissued; manual retry reuses successful per-engine caches where possible. No external scheduler, distributed queue SLA or serverless background guarantee is claimed. Use a long-running single Node service for this prototype; a separate worker/queue is required for managed multi-instance production operation. Production authentication/tenant isolation are not added in this scope; protect the existing prototype with authenticated private access.

## Validation / real example boundary

```sh
npm run lint
npm run typecheck
npm test
npm run build
# Isolated browser database, empty keys; stop other Next dev instances first:
DESKTOP_DATA_DIR=/tmp/baihua-upgrade-browser SERPAPI_API_KEY='' npm run dev -- --port 3001
TEST_BASE_URL=http://localhost:3001 npx playwright test
```

New tests cover parallel provider parameters, per-engine failures/retry limits, public WhatsApp formats, ordinary-phone separation, ownership association, source dedupe, private-address/robots restrictions, additive migration/history retention, manual ownership review, merge alias rediscovery, caches, scoring unknowns, HS boundaries, quantity/growth parsing, imports/exports and the actual browser workflows. Provider responses in automated success tests are explicitly synthetic fixtures; they do not prove real account entitlement.

No usable cloud SerpAPI key is configured and direct provider access has been blocked by cloud networking. Therefore **no successful fresh live Yandex/Google search example is claimed or invented**. To produce a genuine example, use your existing key locally, run a real search, then open **Search tasks, errors & API usage → Export stored search example** on that successful/partial task. It exports the actual stored query, provider provenance, timestamps and results without exposing the key. Do not substitute fixture screenshots or the earlier user screenshot for a newly executed cloud query.

## Production deployment

Use a long-running Node 22.9+/24 service with external PostgreSQL, authenticated private access and backups. Configure DATABASE_URL in the host secret store and remove DESKTOP_DATA_DIR, inject SerpAPI credentials securely, run npm ci, npm run db:migrate, npm run build, then npm start. The production start helper serves the generated Next standalone server and copies its static/public assets; PORT (or --port) selects the port and BAIHUA_BIND_HOST optionally selects the interface. Do not expose an unauthenticated customer database to the public Internet. Use a separate worker/queue for serverless or multi-instance deployments; this prototype's queue is application-local. Existing Electron build preparation remains separate and strips private environment files from packaged artifacts.
