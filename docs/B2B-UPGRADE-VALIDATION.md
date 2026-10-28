# Upgrade validation · 2026-10-28 (Asia/Shanghai)

| Check | Observed outcome |
| --- | --- |
| Frozen dependency installation | `scripts/ensure-dependencies.cjs` executed `npm ci` successfully; 508 packages installed; integrity/TLS verification preserved |
| Repeat startup dependency check | Matching lock fingerprint detected; no redundant reinstall |
| Additive migration | `npm run db:migrate` executed twice against a separate persistent PGlite directory, both completed |
| Legacy data retention | Actual PGlite regression compared historical raw CRM JSON (notes/status/follow-up/custom fields), then verified source/contacts/history retention through rediscovery and alias merge |
| Lint | Passed configured correctness checks on old/new workflow files and startup/configuration helpers |
| TypeScript | `npm run typecheck` passed |
| Unit/database tests | `npm test`: 51 passed, 0 failed, 0 skipped |
| Production build | `npm run build` passed; existing pages and all new APIs generated |
| Production startup | `npm start -- --port 3001` launched the standalone server with prepared static assets and no unsupported Next-start warning |
| Production browser tests | `TEST_BASE_URL=http://localhost:3001 npx playwright test`: 17 passed, 0 failed (14.2 seconds on the final run) |
| Legacy behavior | Demo filtering/pagination, CRM persistence, introduction templates, bilingual/mobile layout, download route and legacy API errors passed |
| Upgraded behavior | Per-engine parallel/partial/error handling, queue/history/cache, contact extraction/ownership state, evidence review/filtering/export, trade scope and configuration-value preservation passed |
| Windows launcher files | CRLF byte validation passed; Node helper logic exercised on Linux. Windows GUI/installer launch was not executed in this cloud machine |
| Genuine provider/account verification | **Blocked**: no cloud SerpAPI/Yandex credential configured. Success tests use explicit synthetic fixtures. No live account entitlement or new company result sample claimed |

The concrete application preflight in [B2B-CLOUD-LIVE-VERIFICATION.json](B2B-CLOUD-LIVE-VERIFICATION.json) submitted a Russian B2B query to the real running application. Both engines correctly reported `MISSING_API_KEY`, zero provider requests were attempted and zero results were created. This is failure evidence, not a successful live search sample.

A genuine local sample can be exported only after a real successful/partial request: Search tasks → Export stored search example. It preserves actual queries, engines, result/source URLs, retrieval times and statuses while excluding the API credential.

External PostgreSQL production connectivity, real SerpAPI account/engine access, paid company-import APIs, official WhatsApp registration/deliverability checks, direct private-platform access and Windows installer acceptance have not been verified. Those limits are not replaced by passing fixture tests. No new public deployment or cloud environment publication is claimed.
