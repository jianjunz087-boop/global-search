import { test } from "node:test";
import assert from "node:assert/strict";
import {
	collectLive,
	parseTrade,
	parseTrends,
	queryID,
	validateLiveQuery,
	CollectionError,
} from "../lib/intelligence/live";
import {
	sourceStates,
	createCollectionHandler,
} from "../lib/intelligence/collection";
const now = "2026-10-27T00:00:00.000Z";
const q = validateLiveQuery({
	source: "google-trends",
	country: "United States",
	product: "DIY Cluster Lashes",
	range: "today 12-m",
});
const trade = validateLiveQuery({
	source: "comtrade",
	country: "United States",
	year: 2024,
	hsCode: "670419",
});
const payload = {
	interest_over_time: {
		timeline_data: [
			{
				timestamp: "1767225600",
				date: "Jan 1 – Jan 7, 2026",
				values: [{ extracted_value: 0, value: "0" }],
			},
			{
				timestamp: "1767830400",
				values: [{ extracted_value: 45, value: "45" }],
			},
		],
	},
};
const tradePayload = {
	data: [
		{
			reporterCode: 842,
			cmdCode: "670419",
			cmdDesc: "SYNTHETIC TEST broad hair-article category, not actual trade",
			period: "2024",
			flowCode: "M",
			partnerCode: 0,
			partner2Code: 0,
			customsCode: "C00",
			motCode: 0,
			primaryValue: 123,
			classificationCode: "H6",
			isReported: true,
		},
	],
};
test("live query validates countries, product, year, HS scope and normalizes keyword", () => {
	assert.equal(q.keyword, "DIY Cluster Lashes");
	assert.equal(queryID(q), queryID({ ...q }));
	for (const invalid of [
		{ ...q, country: "Unknown" },
		{ ...q, range: "unsupported" },
		{ ...q, product: "unmapped" },
		{ ...trade, year: 2099 },
		{ ...trade, hsCode: "TOTAL" },
	])
		assert.throws(() => validateLiveQuery(invalid), CollectionError);
});
test("Trends parses actual zero, records provenance and excludes missing, partial and censored values", () => {
	const result = parseTrends(payload, q, now);
	assert.equal(result.observations.length, 2);
	assert.equal(result.observations[0].value, 0);
	assert.equal(result.observations[0].sourceId, "google-trends");
	assert.match(result.observations[0].limitations, /NOT sales/);
	assert.match(result.observations[0].sourceUrl, /geo=US/);
	const bad = {
		interest_over_time: {
			timeline_data: [
				...payload.interest_over_time.timeline_data,
				{ timestamp: "1768435200", values: [{ extracted_value: null }] },
				{
					timestamp: "1769040000",
					values: [{ extracted_value: 1, value: "<1" }],
				},
				{
					timestamp: "1769644800",
					isPartial: true,
					values: [{ extracted_value: 12 }],
				},
				{ timestamp: "n/a", values: [{ extracted_value: 12 }] },
			],
		},
	};
	assert.equal(parseTrends(bad, q, now).skipped, 4);
	assert.throws(() => parseTrends({}, q, now));
});
test("Comtrade retains broad category, USD, revision and never creates eyelash observations", () => {
	const result = parseTrade(
		tradePayload,
		trade,
		now,
		"https://comtradeapi.un.org/fixture",
	);
	assert.equal(result.trades[0].value, 123);
	assert.equal(result.trades[0].classification, "H6");
	assert.match(result.trades[0].limitations, /NOT eyelash-only/);
	assert.equal(result.trades[0].unit, "USD");
	for (const changes of [
		{ reporterCode: 643 },
		{ partnerCode: 1 },
		{ partnerCode: null },
		{ flowCode: "X" },
		{ primaryValue: null },
		{ period: "2023" },
		{ cmdCode: "670420" },
	])
		assert.equal(
			parseTrade(
				{ data: [{ ...tradePayload.data[0], ...changes }] },
				trade,
				now,
				"https://comtradeapi.un.org/fixture",
			).trades.length,
			0,
		);
	assert.throws(
		() =>
			parseTrade(
				{ data: [tradePayload.data[0], tradePayload.data[0]] },
				trade,
				now,
				"https://comtradeapi.un.org/fixture",
			),
		/Multiple aggregate/,
	);
});
test("provider call uses exact fixed endpoint and keeps secret out of stored results", async () => {
	const result = await collectLive(q, {
		key: "SYNTHETIC-TEST-KEY",
		now,
		fetcher: async (url, init) => {
			const u = new URL(String(url));
			assert.equal(u.hostname, "serpapi.com");
			assert.equal(u.searchParams.get("engine"), "google_trends");
			assert.equal(u.searchParams.get("data_type"), "TIMESERIES");
			assert.equal(u.searchParams.get("api_key"), "SYNTHETIC-TEST-KEY");
			assert.ok(init?.signal);
			return Response.json(payload);
		},
	});
	assert.equal(result.observations.length, 2);
	assert.ok(!JSON.stringify(result).includes("SYNTHETIC-TEST-KEY"));
	const official = await collectLive(trade, {
		now,
		fetcher: async (url) => {
			const u = new URL(String(url));
			assert.equal(u.hostname, "comtradeapi.un.org");
			assert.equal(u.searchParams.get("reporterCode"), "842");
			assert.equal(u.searchParams.get("maxRecords"), "500");
			assert.equal(u.searchParams.get("api_key"), null);
			return Response.json(tradePayload);
		},
	});
	assert.equal(official.trades.length, 1);
	assert.equal(official.observations.length, 0);
});
test("missing key never fetches; provider denial, quota, timeout and malformed JSON remain explicit", async () => {
	await assert.rejects(
		() =>
			collectLive(q, {
				fetcher: async () => {
					throw new Error("Must never fetch");
				},
			}),
		(e: unknown) =>
			e instanceof CollectionError && e.code === "MISSING_API_KEY",
	);
	const cases: [() => Promise<Response>, string][] = [
		[async () => new Response("", { status: 401 }), "ACCESS_DENIED"],
		[async () => new Response("", { status: 429 }), "QUOTA_EXCEEDED"],
		[
			async () => Response.json({ error: "Invalid API key SYNTHETIC-SECRET" }),
			"INVALID_API_KEY",
		],
		[
			async () => Response.json({ error: "Your searches quota exhausted" }),
			"QUOTA_EXCEEDED",
		],
		[
			async () => {
				throw new DOMException("timeout", "TimeoutError");
			},
			"TIMEOUT",
		],
		[async () => new Response("not JSON"), "INVALID_RESPONSE"],
		[
			async () => {
				throw new Error("network");
			},
			"NETWORK_ERROR",
		],
	];
	for (const [fetcher, code] of cases)
		await assert.rejects(
			() => collectLive(q, { key: "SYNTHETIC-SECRET", fetcher }),
			(e: unknown) =>
				e instanceof CollectionError &&
				e.code === code &&
				!e.message.includes("SYNTHETIC-SECRET"),
		);
});
function repository() {
	const records = new Map<string, any>();
	const locks = new Set<string>();
	return {
		records,
		query: async (sql: string, params: unknown[] = []) => {
			if (sql.startsWith("SELECT data")) {
				const kind = sql.includes("kind='collection'")
					? "collection"
					: "source-run";
				const data = records.get(kind + ":" + params[0]);
				return { rows: data ? [{ data }] : [], rowCount: data ? 1 : 0 };
			}
			if (sql.includes("intelligence_collection_guard")) {
				const id = String(params[0]);
				if (locks.has(id)) return { rows: [], rowCount: 0 };
				locks.add(id);
				return { rows: [{ id }], rowCount: 1 };
			}
			if (sql.startsWith("INSERT INTO intelligence_records SELECT")) {
				for (const r of JSON.parse(String(params[0])))
					records.set(r.kind + ":" + r.id, r.data);
				return { rows: [], rowCount: 1 };
			}
			if (sql.startsWith("INSERT INTO intelligence_records VALUES"))
				records.set("source-run:" + params[0], JSON.parse(String(params[1])));
			return { rows: [], rowCount: 0 };
		},
	};
}
const request = (body: unknown, origin?: string) =>
	new Request("http://localhost:3000/api/intelligence/collect", {
		method: "POST",
		headers: {
			"Content-Type": "application/json",
			host: "localhost:3000",
			...(origin ? { origin } : {}),
		},
		body: JSON.stringify(body),
	});
test("collection persists provenance atomically, caches same query and throttles new queries", async () => {
	const db = repository();
	let calls = 0;
	const handler = createCollectionHandler({
		database: async () => db,
		key: () => "SYNTHETIC-KEY",
		fetcher: async () => {
			calls++;
			return Response.json(payload);
		},
	});
	const first = await handler(request(q));
	assert.equal(first.status, 200);
	const a = await first.json();
	assert.equal(a.received, 2);
	assert.equal(a.cached, false);
	assert.equal(
		[...db.records.keys()].filter((k) => k.startsWith("observation:")).length,
		2,
	);
	const second = await handler(request(q));
	assert.equal((await second.json()).cached, true);
	assert.equal(calls, 1);
	const third = await handler(request({ ...q, keyword: "another query" }));
	assert.equal(third.status, 429);
	assert.equal(calls, 1);
	assert.ok(
		!JSON.stringify([...db.records.values()]).includes("SYNTHETIC-KEY"),
	);
});
test("empty series is an empty result, not fabricated zero; no key and cross-origin fail safely", async () => {
	const db = repository();
	const h = createCollectionHandler({
		database: async () => db,
		key: () => "SYNTHETIC",
		fetcher: async () =>
			Response.json({ interest_over_time: { timeline_data: [] } }),
	});
	const response = await h(request(q));
	assert.equal((await response.json()).received, 0);
	assert.equal(
		db.records.get("source-run:google-trends").status,
		"Empty result",
	);
	assert.equal(db.records.get("source-run:google-trends").lastCollected, null);
	const missing = createCollectionHandler({
		database: async () => {
			throw new Error("Must not access DB");
		},
		key: () => undefined,
		fetcher: fetch,
	});
	assert.equal((await missing(request(q))).status, 503);
	assert.equal((await h(request(q, "https://other.example"))).status, 403);
});
test("failed provider request retains previous data timestamp and records safe error state", async () => {
	const db = repository();
	db.records.set("source-run:google-trends", {
		lastSuccessAt: "2026-01-01",
		lastCollected: "2026-01-01",
	});
	const h = createCollectionHandler({
		database: async () => db,
		key: () => "SYNTHETIC-SECRET",
		fetcher: async () =>
			Response.json({ error: "Invalid API key SYNTHETIC-SECRET" }),
	});
	const response = await h(request(q));
	assert.equal(response.status, 502);
	const state = db.records.get("source-run:google-trends");
	assert.equal(state.lastCollected, "2026-01-01");
	assert.equal(state.status, "Failed");
	assert.ok(!state.lastError.includes("SYNTHETIC-SECRET"));
});
test("source metadata exposes presence and verified attempt separately, never keys", () => {
	const states = sourceStates([], false);
	assert.equal(states.find((s) => s.id === "google-trends")?.configured, false);
	assert.match(
		states.find((s) => s.id === "comtrade")!.status,
		/not yet verified/,
	);
	assert.equal(states.find((s) => s.id === "comtrade")?.lastSuccessAt, null);
});
