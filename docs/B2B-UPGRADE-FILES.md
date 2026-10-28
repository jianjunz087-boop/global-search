# Upgrade file list

Actual changes relative to the previous delivered branch. Generated Next type paths are excluded. Private .env.local, customer/database files and downloaded runtime binaries are never included.

| File | Purpose |
| --- | --- |
| `.env.example` | Configuration / documentation |
| `.gitattributes` | Configuration / documentation |
| `CONFIGURE-API.bat` | Configuration / setup / migration / Windows or production startup |
| `README.md` | Configuration / documentation |
| `START-WINDOWS.bat` | Configuration / setup / migration / Windows or production startup |
| `app/api/contacts/route.ts` | Compatibility-preserving endpoint dispatch/enriched reads |
| `app/api/leads/route.ts` | Compatibility-preserving endpoint dispatch/enriched reads |
| `app/api/prospecting/export/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/import/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/merge/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/profile/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/settings/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/tasks/route.ts` | Additive API for the upgraded workflow |
| `app/api/prospecting/trade/route.ts` | Additive API for the upgraded workflow |
| `app/api/search/route.ts` | Compatibility-preserving endpoint dispatch/enriched reads |
| `app/page.tsx` | Existing CRM integration; original actions preserved |
| `app/prospecting.css` | Scoped UI styles |
| `components/prospecting/CompanyTrade.tsx` | Modular controls/dossier within the original interface |
| `components/prospecting/DiscoveryControls.tsx` | Modular controls/dossier within the original interface |
| `components/prospecting/LeadDossier.tsx` | Modular controls/dossier within the original interface |
| `components/prospecting/ScoreSettings.tsx` | Modular controls/dossier within the original interface |
| `components/prospecting/WhatsAppCell.tsx` | Modular controls/dossier within the original interface |
| `docs/B2B-CLOUD-LIVE-VERIFICATION.json` | Usage / schema / API configuration / validation documentation |
| `docs/B2B-UPGRADE-FILES.md` | Usage / schema / API configuration / validation documentation |
| `docs/B2B-UPGRADE-VALIDATION.md` | Usage / schema / API configuration / validation documentation |
| `docs/B2B-UPGRADE-ZH.md` | Usage / schema / API configuration / validation documentation |
| `docs/B2B-UPGRADE.md` | Usage / schema / API configuration / validation documentation |
| `lib/countries.ts` | Country aliases; existing ISO directory retained |
| `lib/db.ts` | Clean shutdown for CLI migration/tests; no destructive schema change |
| `lib/leads.ts` | Optional metadata typing; historical fields retained |
| `lib/prospecting/analysis.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/client.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/contacts.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/crawler.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/export.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/identity.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/providers.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/queries.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/service.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/store.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/trade.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `lib/prospecting/types.ts` | Discovery / contacts / evidence / queue / scoring / export / trade module |
| `package-lock.json` | Pinned dependencies and execution/check scripts |
| `package.json` | Pinned dependencies and execution/check scripts |
| `scripts/configure-env.cjs` | Configuration / setup / migration / Windows or production startup |
| `scripts/ensure-dependencies.cjs` | Configuration / setup / migration / Windows or production startup |
| `scripts/migrate.ts` | Configuration / setup / migration / Windows or production startup |
| `scripts/start-server.mjs` | Configuration / setup / migration / Windows or production startup |
| `tests/browser/prospecting.spec.ts` | Regression/new workflow verification with labeled fixtures |
| `tests/browser/search.spec.ts` | Regression/new workflow verification with labeled fixtures |
| `tests/env-helper.test.ts` | Regression/new workflow verification with labeled fixtures |
| `tests/prospecting-db.test.ts` | Regression/new workflow verification with labeled fixtures |
| `tests/prospecting.test.ts` | Regression/new workflow verification with labeled fixtures |
