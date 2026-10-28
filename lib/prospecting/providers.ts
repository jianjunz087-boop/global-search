import { countryFor } from "../countries";
import type { DiscoveryQuery, Engine, SourceEvidence } from "./types";
import { platformOf, safeURL, researchResource } from "./identity";
export class DiscoveryError extends Error {
	constructor(
		public code: string,
		public engine: string,
		message: string,
		public retryable = false,
	) {
		super(message);
	}
}
export type EngineResult = {
	engine: Engine;
	query: string;
	items: SourceEvidence[];
	hasNext: boolean;
	usage: number;
};
export interface SearchAdapter {
	id: Engine;
	search(q: DiscoveryQuery, text: string): Promise<EngineResult>;
}
export function createSearchAdapters(options: {
	googleKey?: string;
	yandexKey?: string;
	fetcher?: typeof fetch;
	onAttempt?: () => void | Promise<void>;
}) {
	const fetcher = options.fetcher ?? fetch;
	const create = (engine: Engine): SearchAdapter => ({
		id: engine,
		async search(q, text) {
			const key =
				engine === "yandex"
					? options.yandexKey?.trim() || options.googleKey?.trim()
					: options.googleKey?.trim();
			if (!key)
				throw new DiscoveryError(
					"MISSING_API_KEY",
					engine,
					`${engine}: configure SERPAPI_API_KEY on the server (optional separate YANDEX_SERPAPI_KEY for Yandex)`,
				);
			const u = new URL("https://serpapi.com/search.json");
			u.searchParams.set("engine", engine);
			u.searchParams.set(engine === "yandex" ? "text" : "q", text);
			u.searchParams.set("api_key", key);
			if (engine === "google") {
				u.searchParams.set("start", String((q.page - 1) * q.limit));
				u.searchParams.set("num", String(q.limit));
				u.searchParams.set("hl", q.language);
				const geo = countryFor(q.country)?.code;
				if (geo) u.searchParams.set("gl", geo.toLowerCase());
			} else {
				u.searchParams.set("p", String(q.page - 1));
				u.searchParams.set("lang", q.language);
				u.searchParams.set("yandex_domain", "yandex.com");
				if (q.region) u.searchParams.set("lr", q.region);
			}
			let usage = 0;
			for (let attempt = 0; attempt < 2; attempt++) {
				let r: Response;
				try {
					await options.onAttempt?.();
					usage++;
					r = await fetcher(u, {
						cache: "no-store",
						signal: AbortSignal.timeout(q.timeoutMs),
					});
				} catch (e) {
					throw new DiscoveryError(
						e instanceof Error &&
							["TimeoutError", "AbortError"].includes(e.name)
							? "SEARCH_TIMEOUT"
							: "NETWORK_ERROR",
						engine,
						`${engine}: connection failed or timed out. No search results fabricated.`,
					);
				}
				if (r.status >= 500 && attempt === 0) continue;
				if (!r.ok)
					throw new DiscoveryError(
						r.status === 401
							? "INVALID_API_KEY"
							: r.status === 403
								? "ACCESS_DENIED"
								: [402, 429].includes(r.status)
									? "QUOTA_EXCEEDED"
									: "PROVIDER_ERROR",
						engine,
						`${engine}: provider returned HTTP ${r.status}; check account engine access, key and quota`,
					);
				let data: any;
				try {
					data = await r.json();
				} catch {
					throw new DiscoveryError(
						"INVALID_RESPONSE",
						engine,
						`${engine}: provider response is not valid JSON`,
					);
				}
				if (data.error)
					throw new DiscoveryError(
						/key|authentic|unauthor/i.test(String(data.error))
							? "INVALID_API_KEY"
							: /quota|limit|credit|searches|run out/i.test(String(data.error))
								? "QUOTA_EXCEEDED"
								: /engine|support|subscription|plan/i.test(String(data.error))
									? "ENGINE_UNAVAILABLE"
									: "PROVIDER_ERROR",
						engine,
						`${engine}: provider rejected this query. Check key, plan engine access, quota or query availability.`,
					);
				if (!Array.isArray(data.organic_results)) {
					if (
						data.search_information?.organic_results_state === "Fully empty" ||
						(data.search_metadata?.status === "Success" &&
							data.search_information?.total_results === 0)
					)
						data.organic_results = [];
					else
						throw new DiscoveryError(
							"INVALID_RESPONSE",
							engine,
							`${engine}: organic_results is missing; no data fabricated`,
						);
				}
				const collectedAt = new Date().toISOString();
				const items = data.organic_results
					.slice(0, q.limit)
					.flatMap((v: any) => {
						const url = typeof v?.link === "string" ? safeURL(v.link) : null;
						if (!url || typeof v.title !== "string") return [];
						return [
							{
								engine,
								query: text,
								url: url.href,
								originalUrl: v.link,
								title: v.title.slice(0, 500),
								snippet:
									typeof v.snippet === "string"
										? v.snippet.slice(0, 10000)
										: "",
								collectedAt,
								platform: platformOf(url.href),
								resourceOnly: researchResource(url.href, v.title),
								targetCountry: q.country,
							},
						];
					});
				return {
					engine,
					query: text,
					items,
					hasNext: !!(data.serpapi_pagination?.next || data.pagination?.next),
					usage,
				};
			}
			throw new DiscoveryError(
				"PROVIDER_ERROR",
				engine,
				`${engine}: retries exhausted`,
			);
		},
	});
	return { google: create("google"), yandex: create("yandex") };
}
