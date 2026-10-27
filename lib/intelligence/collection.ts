import {
	CollectionError,
	collectLive,
	queryID,
	validateLiveQuery,
} from "./live";
import { tradeWarning, trendsWarning, type SourceState } from "./live-model";
type Row = { kind: string; id?: string; data: Record<string, unknown> };
export function sourceStates(records: Row[], hasKey: boolean): SourceState[] {
	return [
		{
			id: "google-trends",
			name: "Google Trends",
			configured: hasKey,
			credentialRequired: true,
			method: "User-initiated SerpAPI google_trends TIMESERIES",
			url: "https://serpapi.com/google-trends-api",
			restriction: trendsWarning,
			range: "Selected query window",
		},
		{
			id: "comtrade",
			name: "UN Comtrade",
			configured: true,
			credentialRequired: false,
			method:
				"User-initiated public preview, annual world imports, 500-row limit",
			url: "https://comtradeapi.un.org/",
			restriction: tradeWarning,
			range: "Selected completed year",
		},
		{
			id: "search",
			name: "SerpAPI",
			configured: hasKey,
			credentialRequired: true,
			method:
				"Real discovery in existing CRM; separate search results, not verified buyers",
			url: "https://serpapi.com/",
			restriction:
				"Uses provider quota; company identity, location and public contacts require human verification",
			range: "Per query",
		},
	].map((s) => {
		const r =
			records.find((r) => r.kind === "source-run" && r.data.id === s.id)
				?.data ?? {};
		return {
			...s,
			status: !s.configured
				? "Not configured"
				: typeof r.status === "string"
					? r.status
					: "Ready to query · not yet verified",
			lastAttemptAt:
				typeof r.lastAttemptAt === "string" ? r.lastAttemptAt : null,
			lastSuccessAt:
				typeof r.lastSuccessAt === "string" ? r.lastSuccessAt : null,
			lastCollected:
				typeof r.lastCollected === "string" ? r.lastCollected : null,
			lastError: typeof r.lastError === "string" ? r.lastError : null,
		};
	});
}
type Database = {
	query: (
		sql: string,
		params?: unknown[],
	) => Promise<{ rows: any[]; rowCount: number | null }>;
};
export function createCollectionHandler(deps: {
	database: () => Promise<Database>;
	key: () => string | undefined;
	fetcher: typeof fetch;
}) {
	return async (req: Request) => {
		let source: string | undefined,
			db: Database | undefined,
			previous: Record<string, unknown> = {};
		try {
			const origin = req.headers.get("origin");
			if (origin && new URL(origin).host !== req.headers.get("host"))
				throw new CollectionError(
					"CROSS_ORIGIN",
					403,
					"Cross-origin request rejected",
				);
			let body;
			try {
				body = await req.json();
			} catch {
				throw new CollectionError(
					"INVALID_QUERY",
					400,
					"Request must be valid JSON",
				);
			}
			const q = validateLiveQuery(body);
			source = q.source;
			if (source === "google-trends" && !deps.key()?.trim())
				throw new CollectionError(
					"MISSING_API_KEY",
					503,
					"Set SERPAPI_API_KEY in .env.local on your computer, restart the command window and try again. Never send the key in chat.",
				);
			db = await deps.database();
			const fingerprint = queryID(q);
			const cache = (
				await db.query(
					"SELECT data FROM intelligence_records WHERE kind='collection' AND id=$1",
					[fingerprint],
				)
			).rows[0]?.data;
			if (cache && Date.now() - Date.parse(cache.collectedAt) < 15 * 60 * 1000)
				return Response.json({ ...cache, cached: true });
			const lock = await db.query(
				"INSERT INTO intelligence_collection_guard VALUES ($1,now()) ON CONFLICT(id) DO UPDATE SET requested_at=EXCLUDED.requested_at WHERE intelligence_collection_guard.requested_at < now() - interval '60 seconds' RETURNING id",
				[source],
			);
			if (!lock.rows.length)
				throw new CollectionError(
					"RATE_LIMIT",
					429,
					"Wait 60 seconds between new queries for this source. Cached results are reused for 15 minutes.",
				);
			previous =
				(
					await db.query(
						"SELECT data FROM intelligence_records WHERE kind='source-run' AND id=$1",
						[source],
					)
				).rows[0]?.data ?? {};
			const result = await collectLive(q, {
				key: deps.key(),
				fetcher: deps.fetcher,
			});
			const received = result.observations.length + result.trades.length;
			const summary = {
				source,
				query: q,
				collectedAt: result.collectedAt,
				received,
				skipped: result.skipped,
				cached: false,
				message: received
					? "Data stored with source, method, scope and collection time"
					: "Provider returned no usable observations. Missing data is unknown, not zero.",
			};
			const state = {
				id: source,
				status: received ? "Success" : "Empty result",
				lastAttemptAt: result.collectedAt,
				lastSuccessAt: result.collectedAt,
				lastCollected: received
					? result.collectedAt
					: (previous.lastCollected ?? null),
				lastError: null,
			};
			const records = [
				...result.observations.map((data) => ({
					kind: "observation",
					id: data.id,
					data,
				})),
				...result.trades.map((data) => ({ kind: "trade", id: data.id, data })),
				{ kind: "collection", id: fingerprint, data: summary },
				{ kind: "source-run", id: source, data: state },
			];
			await db.query(
				"INSERT INTO intelligence_records SELECT item->>'kind',item->>'id',item->'data' FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data",
				[JSON.stringify(records)],
			);
			return Response.json(summary);
		} catch (e) {
			const known = e instanceof CollectionError;
			const code = known ? e.code : "DATABASE_ERROR",
				status = known ? e.status : 503,
				message = known
					? e.message
					: "Unable to store source data. Check database availability.";
			if (db && source && !["RATE_LIMIT", "CROSS_ORIGIN"].includes(code)) {
				try {
					await db.query(
						"INSERT INTO intelligence_records VALUES ('source-run',$1,$2::jsonb) ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data",
						[
							source,
							JSON.stringify({
								...previous,
								id: source,
								status: "Failed",
								lastAttemptAt: new Date().toISOString(),
								lastError: message,
							}),
						],
					);
				} catch {
					/* Keep the original failure; never log request URLs or keys. */
				}
			}
			return Response.json({ code, error: message }, { status });
		}
	};
}
