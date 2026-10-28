import { prospectDB } from "@/lib/prospecting/store";
import { store } from "@/lib/intelligence/store";
import {
	collectTradeWindow,
	annualChanges,
	candidateHS,
} from "@/lib/prospecting/trade";
import { stableID } from "@/lib/prospecting/identity";
import { CollectionError } from "@/lib/intelligence/live";
export async function GET(req: Request) {
	try {
		const url = new URL(req.url);
		const db = await store();
		const rows = await db.query(
			"SELECT data FROM intelligence_records WHERE kind='trade'",
		);
		const records = rows.rows
			.map((r) => r.data)
			.filter(
				(r) =>
					!url.searchParams.get("country") ||
					r.country === url.searchParams.get("country"),
			);
		return Response.json({
			records: annualChanges(records),
			candidates: candidateHS(
				url.searchParams.get("product") ?? "DIY Cluster Lashes",
			),
			companyRecords:
				"No company-level records unless operator-reviewed documents are explicitly linked in the company dossier.",
		});
	} catch {
		return Response.json(
			{ error: "Trade database unavailable" },
			{ status: 503 },
		);
	}
}
export async function POST(req: Request) {
	let attempted = false;
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin request rejected" },
				{ status: 403 },
			);
		const b = await req.json();
		const query = {
			country: b.country,
			hsCode: b.hsCode,
			years: b.years,
			scope: b.scope,
		};
		const key = stableID(JSON.stringify(query), "trade-window-");
		const db = await prospectDB();
		const cached = (
			await db.query(
				"SELECT data FROM discovery_cache WHERE id=$1 AND expires_at>now()",
				[key],
			)
		).rows[0]?.data;
		if (cached) return Response.json({ ...cached, cached: true });
		const gate = await db.query(
			"INSERT INTO discovery_limits VALUES('trade-window',now()) ON CONFLICT(id) DO UPDATE SET requested_at=EXCLUDED.requested_at WHERE discovery_limits.requested_at<now()-interval '60 seconds' RETURNING id",
		);
		if (!gate.rows.length)
			return Response.json(
				{
					error: "Wait 60 seconds between new trade-window requests",
					code: "RATE_LIMIT",
				},
				{ status: 429 },
			);
		attempted = true;
		const result = await collectTradeWindow(query);
		const intelligence = await store();
		const records: any[] = [
			...result.records.map((data) => ({ kind: "trade", id: data.id, data })),
			...result.partners.map((data: any) => ({
				kind: "trade-partner",
				id: data.id,
				data,
			})),
		];
		records.push({
			kind: "source-run",
			id: "comtrade",
			data: {
				id: "comtrade",
				status: records.length ? "Success" : "Empty result",
				lastAttemptAt: result.collectedAt,
				lastSuccessAt: result.collectedAt,
				...(records.length ? { lastCollected: result.collectedAt } : {}),
				lastError: null,
			},
		});
		await intelligence.query(
			"INSERT INTO intelligence_records SELECT item->>'kind',item->>'id',item->'data' FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(kind,id) DO UPDATE SET data=intelligence_records.data || EXCLUDED.data",
			[JSON.stringify(records)],
		);
		await db.query(
			"INSERT INTO discovery_cache VALUES($1,$2::jsonb,now()+interval '24 hours') ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at",
			[key, JSON.stringify(result)],
		);
		return Response.json({ ...result, cached: false });
	} catch (e) {
		if (
			attempted &&
			(!(e instanceof CollectionError) || e.code !== "INVALID_QUERY")
		) {
			try {
				const db = await store();
				const update = {
					id: "comtrade",
					status: "Failed",
					lastAttemptAt: new Date().toISOString(),
					lastError:
						e instanceof CollectionError
							? e.message
							: "Trade storage unavailable",
				};
				await db.query(
					"INSERT INTO intelligence_records VALUES('source-run','comtrade',$1::jsonb) ON CONFLICT(kind,id) DO UPDATE SET data=intelligence_records.data || EXCLUDED.data",
					[JSON.stringify(update)],
				);
			} catch {
				/* Preserve the original error and prior successful data. */
			}
		}
		return Response.json(
			{
				error:
					e instanceof CollectionError
						? e.message
						: "Unable to query or store trade data",
				code: e instanceof CollectionError ? e.code : "DATABASE_ERROR",
			},
			{ status: e instanceof CollectionError ? e.status : 503 },
		);
	}
}
