import { test } from "node:test";
import assert from "node:assert/strict";
import {
	createSearchAdapters,
	DiscoveryError,
} from "../lib/prospecting/providers";
import {
	validateDiscovery,
	discoveryText,
	suggestedLanguage,
	suggestedQueries,
} from "../lib/prospecting/queries";
import {
	canonicalCompany,
	sameOwner,
	researchResource,
} from "../lib/prospecting/identity";
import {
	normalizePhone,
	extractPublicContacts,
	contactsFromHTML,
	bestPublicWhatsApp,
	combineContactEvidence,
	scopeContact,
} from "../lib/prospecting/contacts";
import {
	publicIP,
	validatePublicWebsite,
	collectWebsitePages,
} from "../lib/prospecting/crawler";
import { analyzeLead, validateWeights } from "../lib/prospecting/analysis";
import {
	candidateHS,
	annualChanges,
	collectTradeWindow,
} from "../lib/prospecting/trade";
import { prospectsCSV, exportHeaders } from "../lib/prospecting/export";
import { defaultWeights, type SourceEvidence } from "../lib/prospecting/types";
import type { Lead } from "../lib/leads";
const fixture: SourceEvidence = {
	engine: "google",
	query: "SYNTHETIC TEST QUERY",
	url: "https://supplier.example/contact",
	title: "SYNTHETIC TEST supplier — not a real company",
	snippet:
		"Eyelash wholesale distributor and private label. WhatsApp: +44 7700 900123. Phone: +44 7700 900456. Email: trade@supplier.example",
	collectedAt: "2026-10-28T00:00:00Z",
	platform: "web",
	targetCountry: "Russia",
};
const lead: Lead = {
	id: "test-only",
	name: fixture.title,
	website: "https://supplier.example",
	source: fixture.url,
	country: "Not verified",
	targetCountry: "Russia",
	type: "Unverified B2B candidate",
	email: "",
	whatsapp: "",
	score: 0,
	status: "New",
	note: "CRM note must survive",
	nextFollowUp: "",
	tags: [],
	mock: false,
};
test("localized queries support priority markets, custom terms and safe platform scopes", () => {
	assert.equal(suggestedLanguage("Kazakhstan"), "ru");
	assert.equal(suggestedLanguage("Poland"), "pl");
	assert.equal(suggestedLanguage("Turkey"), "tr");
	assert.match(suggestedQueries("Russia")[0], /ресницы/);
	const q = validateDiscovery({
		country: "Russia",
		engine: "both",
		keyword: "",
		platform: "telegram",
	});
	assert.match(discoveryText(q), /ресницы/);
	assert.match(discoveryText(q), /site:t.me/);
	assert.throws(() => validateDiscovery({ engine: "evil" }));
	assert.throws(() => validateDiscovery({ limit: 100 }));
});
test("Google and Yandex adapters use distinct supported parameters and can run concurrently", async () => {
	const calls: URL[] = [];
	let active = 0,
		max = 0;
	const adapters = createSearchAdapters({
		googleKey: "SYNTHETIC-GOOGLE",
		yandexKey: "SYNTHETIC-YANDEX",
		fetcher: async (u) => {
			calls.push(new URL(String(u)));
			active++;
			max = Math.max(max, active);
			await new Promise((r) => setTimeout(r, 20));
			active--;
			return Response.json({
				organic_results: [
					{ title: fixture.title, link: fixture.url, snippet: fixture.snippet },
				],
				serpapi_pagination: { next: "https://serpapi.com/next" },
			});
		},
	});
	const q = validateDiscovery({
		engine: "both",
		country: "Russia",
		region: "225",
		page: 2,
	});
	const r = await Promise.all([
		adapters.google.search(q, "test query"),
		adapters.yandex.search(q, "test query"),
	]);
	assert.equal(max, 2);
	assert.equal(calls[0].searchParams.get("q"), "test query");
	assert.equal(calls[0].searchParams.get("start"), "10");
	assert.equal(calls[1].searchParams.get("text"), "test query");
	assert.equal(calls[1].searchParams.get("p"), "1");
	assert.equal(calls[1].searchParams.get("lr"), "225");
	assert.equal(calls[1].searchParams.get("api_key"), "SYNTHETIC-YANDEX");
	assert.equal(r[1].items[0].engine, "yandex");
	assert.ok(!JSON.stringify(r).includes("SYNTHETIC-YANDEX"));
});
test("Yandex missing credentials, access denial, quota, timeout and unsupported plan are explicit", async () => {
	const q = validateDiscovery({ engine: "yandex" });
	await assert.rejects(
		() =>
			createSearchAdapters({
				fetcher: async () => {
					throw Error("must not fetch");
				},
			}).yandex.search(q, "test"),
		(e: any) => e.code === "MISSING_API_KEY",
	);
	for (const [fetcher, code] of [
		[async () => new Response("", { status: 401 }), "INVALID_API_KEY"],
		[async () => new Response("", { status: 429 }), "QUOTA_EXCEEDED"],
		[
			async () =>
				Response.json({ error: "Yandex engine unavailable on subscription" }),
			"ENGINE_UNAVAILABLE",
		],
		[
			async () => {
				throw new DOMException("SYNTHETIC-KEY", "TimeoutError");
			},
			"SEARCH_TIMEOUT",
		],
	] as const)
		await assert.rejects(
			() =>
				createSearchAdapters({
					googleKey: "SYNTHETIC-KEY",
					fetcher,
				}).yandex.search(q, "test"),
			(e: unknown) =>
				e instanceof DiscoveryError &&
				e.code === code &&
				!e.message.includes("SYNTHETIC-KEY"),
		);
});
test("only transient HTTP 5xx retries once; quota failures never retry automatically", async () => {
	let calls = 0;
	const q = validateDiscovery({});
	const a = createSearchAdapters({
		googleKey: "test-only",
		fetcher: async () =>
			++calls === 1
				? new Response("", { status: 503 })
				: Response.json({ organic_results: [] }),
	});
	await a.google.search(q, "fixture");
	assert.equal(calls, 2);
	calls = 0;
	await assert.rejects(() =>
		createSearchAdapters({
			googleKey: "test-only",
			fetcher: async () => {
				calls++;
				return new Response("", { status: 429 });
			},
		}).google.search(q, "fixture"),
	);
	assert.equal(calls, 1);
});
test("company domains dedupe while unrelated social accounts and posts stay separate", () => {
	assert.equal(
		canonicalCompany("https://www.supplier.example/about?utm_source=x"),
		"domain:supplier.example",
	);
	assert.notEqual(
		canonicalCompany("https://instagram.com/brand_one"),
		canonicalCompany("https://instagram.com/brand_two"),
	);
	assert.notEqual(
		canonicalCompany("https://t.me/channel_one"),
		canonicalCompany("https://t.me/channel_two"),
	);
	assert.equal(
		sameOwner(
			"https://supplier.example.evil.example",
			"https://supplier.example",
		),
		false,
	);
	assert.equal(
		sameOwner(
			"https://instagram.com/brand_two",
			"https://instagram.com/brand_one",
		),
		false,
	);
});
test("WhatsApp extraction handles wa.me, reordered API parameters and international labels with provenance", () => {
	const html =
		'<html><body><a href="https://wa.me/447700900123">WhatsApp</a><a href="https://api.whatsapp.com/send?text=hi&amp;phone=%2B447700900456">WA</a><p>WhatsApp: +44 7700 900789</p><a href="https://instagram.com/example_business">Instagram</a><a href="https://t.me/example_business">Telegram</a></body></html>';
	const contacts = contactsFromHTML(html, fixture.url, lead.website);
	assert.equal(contacts.filter((c) => c.kind === "whatsapp").length, 3);
	assert.ok(contacts.every((c) => c.sourceUrl === fixture.url));
	assert.ok(
		contacts
			.filter((c) => c.kind === "whatsapp")
			.every(
				(c) =>
					c.format === "valid" &&
					c.identity === "unverified" &&
					c.availability === "not-checked",
			),
	);
	assert.ok(contacts.some((c) => c.kind === "instagram"));
	assert.ok(contacts.some((c) => c.kind === "telegram"));
});
test("ordinary phones never become WhatsApp and national numbers require independently verified country", () => {
	const contacts = extractPublicContacts({
		text: "Phone: +44 7700 900456",
		website: lead.website,
		sourceUrl: fixture.url,
		method: "test fixture",
	});
	assert.equal(contacts.filter((c) => c.kind === "whatsapp").length, 0);
	assert.equal(contacts[0].kind, "phone");
	assert.equal(normalizePhone("07700 900123"), null);
	assert.equal(normalizePhone("07700 900123", "GB")?.number, "+447700900123");
	const wa = extractPublicContacts({
		text: "WhatsApp: 07700 900123",
		website: lead.website,
		sourceUrl: fixture.url,
		method: "test fixture",
	}).find((c) => c.kind === "whatsapp");
	assert.equal(wa?.format, "unresolved");
	assert.equal(wa?.directUrl, undefined);
});
test("unrelated-site numbers remain ownership candidates and scripts do not generate phantom contacts", () => {
	const c = extractPublicContacts({
		text: "WhatsApp: +44 7700 900123",
		sourceUrl: "https://unrelated.example",
		website: lead.website,
		method: "indexed fixture",
	});
	assert.equal(c[0].association, "related-unverified");
	assert.equal(c[0].directUrl, undefined);
	assert.equal(bestPublicWhatsApp(c), undefined);
	assert.equal(
		contactsFromHTML(
			"<script>WhatsApp: +44 7700 900123</script><body>Phone: +44 7700 900456</body>",
			fixture.url,
			lead.website,
		).filter((c) => c.kind === "whatsapp").length,
		0,
	);
});
test("crawler blocks private/local endpoints, respects robots and never visits social platforms directly", async () => {
	for (const ip of [
		"127.0.0.1",
		"10.1.2.3",
		"169.254.169.254",
		"::1",
		"::ffff:127.0.0.1",
	])
		assert.equal(publicIP(ip), false);
	assert.equal(publicIP("8.8.8.8"), true);
	await assert.rejects(() =>
		validatePublicWebsite(
			"https://supplier.example",
			async () => [{ address: "127.0.0.1", family: 4 }] as any,
		),
	);
	let calls: string[] = [];
	const r = await collectWebsitePages("https://supplier.example", {
		getter: async (u) => {
			calls.push(u);
			return {
				status: 200,
				body: "User-agent: *\nDisallow: /",
				type: "text/plain",
			};
		},
	});
	assert.equal(r.pages.length, 0);
	assert.equal(calls.length, 1);
	calls = [];
	await collectWebsitePages("https://instagram.com/example_business", {
		getter: async (u) => {
			calls.push(u);
			throw Error("must not fetch");
		},
	});
	assert.equal(calls.length, 0);
});
test("score separates inferences, manual facts and unknowns; national trade never earns company import points", () => {
	const c = extractPublicContacts({
		text: fixture.snippet,
		sourceUrl: fixture.url,
		website: lead.website,
		method: "fixture",
	});
	const a = analyzeLead(lead, [fixture], c);
	assert.equal(a.components.find((c) => c.key === "imports")?.earned, 0);
	assert.equal(a.components.find((c) => c.key === "activity")?.earned, 0);
	assert.equal(a.facts.length, 0);
	assert.ok(a.inferences.length > 0);
	assert.ok(a.coverage < 100);
	assert.match(a.importStatus, /暂无企业级进口数据/);
	assert.throws(() => validateWeights({ ...defaultWeights, imports: 11 }));
	assert.equal(analyzeLead(lead, [], []).score, 0);
});
test("HS candidate rules separate adhesives/tools/kits; YoY requires matching revisions and adjacent years", () => {
	for (const p of ["Lash Glue", "Tweezers", "DIY Lash Kits"])
		assert.deepEqual(candidateHS(p).codes, []);
	assert.match(candidateHS("DIY Cluster Lashes").state, /Pending/);
	const rows = annualChanges([
		{ year: 2021, value: 100, hsCode: "670419", classification: "H6" },
		{ year: 2022, value: 150, hsCode: "670419", classification: "H6" },
		{ year: 2023, value: 200, hsCode: "670419", classification: "H5" },
	]);
	assert.equal(rows[1].yoy, 50);
	assert.equal(rows[2].yoy, null);
});
test("export keeps provenance, contact state, score reasoning and explicitly unknown imports", () => {
	const intel = {
		sources: [fixture],
		contacts: [],
		manual: {},
		analysis: analyzeLead(lead, [fixture], []),
		targetCountry: "Russia",
	};
	const data = prospectsCSV([{ ...lead, intel }]);
	for (const label of [
		"Contact evidence JSON",
		"Score components JSON",
		"Company import records JSON",
		"Sources JSON",
	])
		assert.ok(exportHeaders.includes(label));
	assert.match(data, /暂无企业级进口数据/);
	assert.match(data, /supplier.example/);
	assert.ok(!data.includes("SYNTHETIC-KEY"));
});
test("multi-year trade request reads reported quantities and preserves missing years", async () => {
	const r = await collectTradeWindow(
		{
			country: "United States",
			hsCode: "670419",
			years: [2023, 2024],
			scope: "annual",
		},
		async (u) => {
			assert.equal(new URL(String(u)).searchParams.get("period"), "2023,2024");
			return Response.json({
				data: [
					{
						reporterCode: 842,
						period: 2024,
						cmdCode: "670419",
						cmdDesc: "Synthetic test broad category — not actual trade",
						flowCode: "M",
						partnerCode: 0,
						partner2Code: 0,
						customsCode: "C00",
						motCode: 0,
						primaryValue: 10,
						classificationCode: "H6",
						qty: 3,
						qtyUnitAbbr: "kg",
						isQtyEstimated: true,
					},
				],
			});
		},
	);
	assert.equal(r.records[0].quantity, 3);
	assert.equal(r.records[0].quantityEstimated, true);
	assert.deepEqual(r.missingYears, [2023]);
	assert.match(r.coverage, /no eyelash-specific/);
});

test("research directories are not silently classified as company identities", () => {
	assert.equal(
		researchResource(
			"https://directory.example/top-five",
			"Top 5 Eyelash Suppliers",
		),
		true,
	);
	assert.equal(
		researchResource("https://facebook.com/groups/123", "Wholesale group"),
		true,
	);
	assert.equal(
		researchResource(
			"https://company.example/wholesale",
			"Wholesale product catalogue",
		),
		false,
	);
});
test("same contact is displayed once with all sources retained and manual ownership takes precedence", () => {
	const a = extractPublicContacts({
		text: "WhatsApp: +44 7700 900123",
		sourceUrl: "https://supplier.example/contact",
		website: lead.website,
		method: "indexed test",
	});
	const b = {
		...a[0],
		id: "second-source",
		sourceUrl: "https://supplier.example/wholesale",
		identity: "manually-confirmed" as const,
	};
	const grouped = combineContactEvidence([...a, b]);
	assert.equal(grouped.length, 1);
	assert.equal(grouped[0].sources?.length, 2);
	assert.equal(grouped[0].identity, "manually-confirmed");
	assert.equal(bestPublicWhatsApp([...a, b])?.id, "second-source");
});

test("explicit public social handles and unlabeled international phones are extracted without asserting WhatsApp", () => {
	const contacts = extractPublicContacts({
		text: "Instagram: @synthetic_business Telegram: @synthetic_business +44 7700 900456",
		sourceUrl: fixture.url,
		website: lead.website,
		method: "Synthetic extraction fixture",
	});
	assert.ok(contacts.some((c) => c.kind === "instagram"));
	assert.ok(contacts.some((c) => c.kind === "telegram"));
	assert.ok(contacts.some((c) => c.kind === "phone"));
	assert.equal(
		contacts.some((c) => c.kind === "whatsapp"),
		false,
	);
});

test("blank optional Yandex credential reuses the existing SerpAPI key", async () => {
	const adapters = createSearchAdapters({
		googleKey: "SYNTHETIC-FALLBACK-KEY",
		yandexKey: "   ",
		fetcher: async (url) => {
			assert.equal(
				new URL(String(url)).searchParams.get("api_key"),
				"SYNTHETIC-FALLBACK-KEY",
			);
			return Response.json({ organic_results: [] });
		},
	});
	assert.equal(
		(
			await adapters.yandex.search(
				validateDiscovery({ engine: "yandex" }),
				"test",
			)
		).items.length,
		0,
	);
});

test("documented fully empty provider response is a successful empty query, never fabricated leads", async () => {
	const adapter = createSearchAdapters({
		googleKey: "SYNTHETIC-KEY",
		fetcher: async () =>
			Response.json({
				search_metadata: { status: "Success" },
				search_information: { organic_results_state: "Fully empty" },
			}),
	}).google;
	assert.equal(
		(
			await adapter.search(
				validateDiscovery({}),
				"synthetic zero-results query",
			)
		).items.length,
		0,
	);
});

test("shared directory contact candidates stay scoped to each company, never assigned globally to the first record", () => {
	const c = extractPublicContacts({
		text: "WhatsApp: +44 7700 900123",
		sourceUrl: "https://directory.example/contacts",
		website: lead.website,
		method: "Synthetic related-source fixture",
	})[0];
	assert.equal(c.association, "related-unverified");
	assert.notEqual(
		scopeContact(c, "company-one").id,
		scopeContact(c, "company-two").id,
	);
	assert.equal(scopeContact(c, "company-one").directUrl, undefined);
});
