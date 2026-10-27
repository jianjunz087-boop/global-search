import { createHash } from "node:crypto";
import { products } from "./model";
import {
	liveCountries,
	tradeWarning,
	trendsWarning,
	type LiveQuery,
	type TradeContext,
} from "./live-model";
export class CollectionError extends Error {
	constructor(
		public code: string,
		public status: number,
		message: string,
	) {
		super(message);
	}
}
export function validateLiveQuery(value: unknown): LiveQuery {
	if (!value || typeof value !== "object")
		throw new CollectionError("INVALID_QUERY", 400, "Invalid query");
	const q = value as LiveQuery;
	if (
		!["google-trends", "comtrade"].includes(q.source) ||
		!liveCountries.some((c) => c.name === q.country)
	)
		throw new CollectionError(
			"INVALID_QUERY",
			400,
			"Choose a supported source and country",
		);
	if (q.source === "google-trends") {
		if (
			!products.includes(q.product) ||
			!["today 3-m", "today 12-m", "today 5-y"].includes(q.range ?? "") ||
			(q.keyword !== undefined &&
				(typeof q.keyword !== "string" || q.keyword.trim().length > 100))
		)
			throw new CollectionError(
				"INVALID_QUERY",
				400,
				"Choose product and date range; keyword limit is 100 characters",
			);
		return {
			source: q.source,
			country: q.country,
			product: q.product,
			keyword: q.keyword?.trim() || q.product,
			range: q.range,
		};
	}
	if (
		!Number.isInteger(q.year) ||
		q.year! < 2015 ||
		q.year! >= new Date().getUTCFullYear() ||
		!["670419", "670420", "670490"].includes(q.hsCode ?? "")
	)
		throw new CollectionError(
			"INVALID_QUERY",
			400,
			"Choose a completed year since 2015 and a supported broad HS code",
		);
	return {
		source: q.source,
		country: q.country,
		product: "Broad hair-article trade context",
		year: q.year,
		hsCode: q.hsCode,
	};
}
export function queryID(q: LiveQuery) {
	return createHash("sha256")
		.update(JSON.stringify(q))
		.digest("hex")
		.slice(0, 24);
}
function object(v: unknown): Record<string, unknown> {
	return v && typeof v === "object" && !Array.isArray(v)
		? (v as Record<string, unknown>)
		: {};
}
function rows(v: unknown): unknown[] {
	return Array.isArray(v) ? v : [];
}
const id = (s: string) =>
	createHash("sha256").update(s).digest("hex").slice(0, 30);
export function parseTrends(
	payload: unknown,
	q: LiveQuery,
	collectedAt: string,
) {
	const data = object(payload);
	if (data.error)
		throw new CollectionError(
			"PROVIDER_ERROR",
			502,
			"Provider returned an error; check key, account quota and query availability",
		);
	const timeline = object(data.interest_over_time).timeline_data;
	if (!Array.isArray(timeline))
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Trends response contains no supported time series",
		);
	const source = new URL("https://trends.google.com/trends/explore");
	source.searchParams.set("q", q.keyword!);
	source.searchParams.set(
		"geo",
		liveCountries.find((c) => c.name === q.country)!.geo,
	);
	source.searchParams.set("date", q.range!);
	let skipped = 0;
	const seen = new Set<string>();
	const observations = timeline.flatMap((item: unknown) => {
		const r = object(item),
			v = object(rows(r.values)[0]);
		const ts =
			typeof r.timestamp === "string" || typeof r.timestamp === "number"
				? Number(r.timestamp)
				: NaN;
		const n = v.extracted_value;
		if (
			!Number.isFinite(ts) ||
			ts < 0 ||
			ts > Date.parse(collectedAt) / 1000 + 86400 ||
			typeof n !== "number" ||
			!Number.isFinite(n) ||
			n < 0 ||
			n > 100 ||
			String(v.value ?? "").includes("<") ||
			r.isPartial === true ||
			r.is_partial === true ||
			v.isPartial === true
		) {
			skipped++;
			return [];
		}
		const date = new Date(ts * 1000);
		if (Number.isNaN(date.getTime())) {
			skipped++;
			return [];
		}
		const period = date.toISOString().slice(0, 10);
		if (seen.has(period)) {
			skipped++;
			return [];
		}
		seen.add(period);
		return [
			{
				id: "live-trends-" + id(queryID(q) + period),
				name: `Google Trends · ${q.keyword} · ${q.range}`,
				country: q.country,
				product: q.product,
				period,
				periodLabel: typeof r.date === "string" ? r.date : period,
				value: n,
				unit: "search interest index (0–100)",
				method: `SerpAPI google_trends TIMESERIES; geo=${liveCountries.find((c) => c.name === q.country)!.geo}; query=${q.keyword}; window=${q.range}; timezone UTC`,
				limitations: trendsWarning,
				sourceUrl: source.href,
				collectedAt,
				classification: "third-party-search-index",
				sourceId: "google-trends",
				queryFingerprint: queryID(q),
				partialPeriodsExcluded: true,
			},
		];
	});
	return { observations, skipped };
}
export function parseTrade(
	payload: unknown,
	q: LiveQuery,
	collectedAt: string,
	sourceUrl: string,
) {
	const data = object(payload);
	if (!Array.isArray(data.data))
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Trade response has no supported data array",
		);
	let skipped = 0;
	const country = liveCountries.find((c) => c.name === q.country)!;
	const trades = rows(data.data).flatMap((item: unknown) => {
		const r = object(item);
		if (
			String(r.reporterCode) !== country.reporter ||
			String(r.cmdCode) !== q.hsCode ||
			String(r.period) !== String(q.year) ||
			r.flowCode !== "M" ||
			String(r.partnerCode) !== "0" ||
			String(r.partner2Code) !== "0" ||
			r.customsCode !== "C00" ||
			String(r.motCode) !== "0" ||
			typeof r.primaryValue !== "number" ||
			!Number.isFinite(r.primaryValue) ||
			r.primaryValue < 0 ||
			typeof r.cmdDesc !== "string" ||
			!r.cmdDesc
		) {
			skipped++;
			return [];
		}
		const trade: TradeContext = {
			id: "live-trade-" + id(queryID(q)),
			country: q.country,
			year: q.year!,
			hsCode: q.hsCode!,
			classification:
				typeof r.classificationCode === "string"
					? r.classificationCode
					: "Unknown revision",
			description: r.cmdDesc,
			value: r.primaryValue,
			unit: "USD",
			sourceUrl,
			collectedAt,
			method: `UN Comtrade public preview, annual merchandise imports, reporter=${country.reporter}, world partner=0, partner2=0, customs=C00, transport=0, primaryValue in USD`,
			limitations: tradeWarning,
			classificationKind: "official",
			isReported: typeof r.isReported === "boolean" ? r.isReported : null,
		};
		return [trade];
	});
	if (trades.length > 1)
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Multiple aggregate trade rows returned; manual scope review required",
		);
	return { trades, skipped };
}
async function fetchJSON(fetcher: typeof fetch, url: URL) {
	let response: Response;
	try {
		response = await fetcher(url, {
			cache: "no-store",
			signal: AbortSignal.timeout(30000),
		});
	} catch (e) {
		if (e instanceof Error && ["AbortError", "TimeoutError"].includes(e.name))
			throw new CollectionError(
				"TIMEOUT",
				504,
				"Data provider timed out; no data stored",
			);
		throw new CollectionError(
			"NETWORK_ERROR",
			502,
			"Cannot reach provider. Check Internet access, proxy and allowed domains; no data stored",
		);
	}
	if (!response.ok) {
		if (response.status === 401 || response.status === 403)
			throw new CollectionError(
				"ACCESS_DENIED",
				502,
				"Provider or network rejected access. Check API key and domain access",
			);
		if ([402, 429].includes(response.status))
			throw new CollectionError(
				"QUOTA_EXCEEDED",
				429,
				"Provider quota or rate limit reached. No automatic retry; check account limits",
			);
		throw new CollectionError(
			"PROVIDER_ERROR",
			502,
			`Provider returned HTTP ${response.status}; no data stored`,
		);
	}
	try {
		return await response.json();
	} catch {
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Provider returned invalid JSON; no data stored",
		);
	}
}
async function collectSource(
	q: LiveQuery,
	options: { key?: string; fetcher?: typeof fetch; now?: string } = {},
) {
	const fetcher = options.fetcher ?? fetch,
		now = options.now ?? new Date().toISOString();
	if (q.source === "google-trends") {
		const key = options.key?.trim();
		if (!key)
			throw new CollectionError(
				"MISSING_API_KEY",
				503,
				"Set SERPAPI_API_KEY in your local .env.local file and restart START-WINDOWS.bat. Never send the key in chat.",
			);
		const url = new URL("https://serpapi.com/search.json");
		for (const [k, v] of Object.entries({
			engine: "google_trends",
			q: q.keyword!,
			geo: liveCountries.find((c) => c.name === q.country)!.geo,
			date: q.range!,
			data_type: "TIMESERIES",
			tz: "0",
			api_key: key,
		}))
			url.searchParams.set(k, v);
		const payload = await fetchJSON(fetcher, url);
		const obj = object(payload);
		if (obj.error) {
			const message = String(obj.error);
			if (/key|unauthori|authentic/i.test(message))
				throw new CollectionError(
					"INVALID_API_KEY",
					502,
					"SerpAPI rejected the API key; check .env.local and restart",
				);
			if (/quota|limit|credit|searches|run out/i.test(message))
				throw new CollectionError(
					"QUOTA_EXCEEDED",
					429,
					"SerpAPI quota exhausted; check your account plan",
				);
			throw new CollectionError(
				"PROVIDER_ERROR",
				502,
				"Google Trends query failed. The keyword or country may have insufficient data",
			);
		}
		const parsed = parseTrends(payload, q, now);
		return { ...parsed, trades: [], collectedAt: now };
	}
	const url = new URL("https://comtradeapi.un.org/public/v1/preview/C/A/HS");
	for (const [k, v] of Object.entries({
		period: String(q.year),
		reporterCode: liveCountries.find((c) => c.name === q.country)!.reporter,
		cmdCode: q.hsCode!,
		flowCode: "M",
		partnerCode: "0",
		partner2Code: "0",
		customsCode: "C00",
		motCode: "0",
		maxRecords: "500",
		aggregateBy: "6",
		breakdownMode: "classic",
		includeDesc: "true",
	}))
		url.searchParams.set(k, v);
	const payload = await fetchJSON(fetcher, url);
	return {
		...parseTrade(payload, q, now, url.href),
		observations: [],
		collectedAt: now,
	};
}

export interface LiveSourceAdapter {
	readonly id: LiveQuery["source"];
	collect: typeof collectSource;
}
export const liveAdapters: Record<LiveQuery["source"], LiveSourceAdapter> = {
	"google-trends": { id: "google-trends", collect: collectSource },
	comtrade: { id: "comtrade", collect: collectSource },
};
export async function collectLive(
	q: LiveQuery,
	options: Parameters<typeof collectSource>[1] = {},
) {
	return liveAdapters[q.source].collect(q, options);
}
