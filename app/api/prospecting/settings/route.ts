import { validateDiscovery } from "@/lib/prospecting/queries";
import { prospectDB, readWeights } from "@/lib/prospecting/store";
import { validateWeights } from "@/lib/prospecting/analysis";
import { suggestedQueries } from "@/lib/prospecting/queries";
export async function GET(req: Request) {
	try {
		const db = await prospectDB();
		return Response.json({
			weights: await readWeights(db),
			savedSetup:
				(
					await db.query(
						"SELECT data FROM discovery_settings WHERE id='saved-setup'",
					)
				).rows[0]?.data ?? null,
			suggestions: suggestedQueries(
				new URL(req.url).searchParams.get("country") ?? "",
			),
			engines: [
				{
					id: "google",
					provider: "SerpAPI",
					configured: !!process.env.SERPAPI_API_KEY?.trim(),
				},
				{
					id: "yandex",
					provider: "SerpAPI Yandex",
					configured: !!(
						process.env.YANDEX_SERPAPI_KEY?.trim() ||
						process.env.SERPAPI_API_KEY?.trim()
					),
				},
			],
			limits: {
				cacheMinutes: 15,
				requestGapSeconds: 2,
				maxResultsPerEngine: 20,
				maxTransientRetries: 1,
			},
			directYandexAPI:
				"Not selected. YANDEX_API_KEY is not used; existing SerpAPI key is preferred. Account plan access must be verified by a real request.",
		});
	} catch {
		return Response.json({ error: "Database unavailable" }, { status: 503 });
	}
}
export async function POST(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin request rejected" },
				{ status: 403 },
			);
		const b = await req.json(),
			db = await prospectDB();
		if (b.action === "save-setup") {
			const q = validateDiscovery(b.query);
			const filters =
				b.filters && typeof b.filters === "object"
					? Object.fromEntries(
							Object.entries(b.filters)
								.filter(
									([k, v]) =>
										[
											"city",
											"grade",
											"confidence",
											"whatsapp",
											"instagram",
											"telegram",
											"website",
											"imports",
											"b2b",
										].includes(k) && typeof v === "string",
								)
								.map(([k, v]) => [k, String(v).slice(0, 200)]),
						)
					: {};
			await db.query(
				"INSERT INTO discovery_settings VALUES('saved-setup',$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
				[
					JSON.stringify({
						query: { ...q, language: b.query.language ?? "auto" },
						filters,
					}),
				],
			);
			return Response.json({ saved: true });
		}
		const weights = validateWeights(b.weights);
		await db.query(
			"INSERT INTO discovery_settings VALUES('weights',$1::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
			[JSON.stringify(weights)],
		);
		return Response.json({ weights });
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? e.message : "Unable to save settings" },
			{ status: 400 },
		);
	}
}
