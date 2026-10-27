import { store } from "@/lib/intelligence/store";
import { domain, products } from "@/lib/intelligence/model";
export async function GET() {
	try {
		const db = await store();
		const r = await db.query("SELECT kind,data FROM intelligence_records");
		return Response.json({
			markets: r.rows.filter((x) => x.kind === "market").map((x) => x.data),
			buyers: r.rows.filter((x) => x.kind === "buyer").map((x) => x.data),
			settings: r.rows.find((x) => x.kind === "settings")?.data ?? {
				weights: [25, 20, 15, 20, 10, 10],
				reminders: [],
			},
			sources: [
				{
					name: "SerpAPI",
					configured: !!process.env.SERPAPI_API_KEY,
					url: "https://serpapi.com/",
					method: "User-initiated public search via existing CRM",
					range: "Per query",
					restriction: "Provider terms and quota; company location unverified",
					lastCollected: null,
				},
				{
					name: "UN Comtrade",
					configured: false,
					url: "https://comtradeplus.un.org/",
					method: "Not connected",
					range: "Unknown",
					restriction:
						"HS headings may include unrelated products; no eyelash volume inferred",
					lastCollected: null,
				},
				{
					name: "Google Trends",
					configured: false,
					url: "https://trends.google.com/",
					method: "Not connected",
					range: "Unknown",
					restriction:
						"Relative interest is not sales; licensed adapter required",
					lastCollected: null,
				},
			],
			observations: r.rows
				.filter((x) => x.kind === "observation")
				.map((x) => x.data),
			competitors: r.rows
				.filter((x) => x.kind === "competitor")
				.map((x) => x.data),
			products,
		});
	} catch (e) {
		console.error(
			"Intelligence database unavailable",
			e instanceof Error ? e.message : "unknown",
		);
		return Response.json(
			{ error: "Database unavailable. Set DATABASE_URL or DESKTOP_DATA_DIR." },
			{ status: 503 },
		);
	}
}
export async function POST(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin mutation rejected" },
				{ status: 403 },
			);
		const body = await req.json();
		const db = await store();
		if (body.kind === "buyers") {
			if (!Array.isArray(body.items) || body.items.length > 1000)
				return Response.json(
					{ error: "Maximum 1000 rows per import" },
					{ status: 400 },
				);
			const existing = (
				await db.query(
					"SELECT data FROM intelligence_records WHERE kind='buyer'",
				)
			).rows.map((r) => r.data);
			const seen = new Set(existing.map((r) => domain(r.website)));
			const validated = [];
			let duplicates = 0;
			for (const item of body.items) {
				if (
					!item.name?.trim() ||
					!item.country?.trim() ||
					!item.source?.trim() ||
					![
						"Importer",
						"Wholesaler",
						"Distributor",
						"Brand",
						"Beauty supplier",
					].includes(item.type)
				)
					throw new Error("Name, country, source and B2B type are required");
				const key = domain(item.website);
				domain(item.source);
				if (item.id && existing.some((r) => r.id === item.id)) {
					const other = existing.find(
						(r) => r.id !== item.id && domain(r.website) === key,
					);
					if (other) throw new Error("Duplicate company domain");
				} else if (seen.has(key)) {
					duplicates++;
					continue;
				}
				seen.add(key);
				const fields = [
					"name",
					"country",
					"website",
					"type",
					"email",
					"phone",
					"social",
					"products",
					"brand",
					"source",
					"potential",
					"status",
					"lastContact",
					"nextFollowUp",
					"note",
				];
				const clean: Record<string, string> = {
					id: existing.some((r) => r.id === item.id)
						? item.id
						: crypto.randomUUID(),
					collectedAt:
						existing.find((r) => r.id === item.id)?.collectedAt ??
						new Date().toISOString(),
					companyDomain: key,
				};
				for (const f of fields)
					clean[f] = String(item[f] ?? "").slice(0, 10000);
				validated.push(clean);
			}
			await db.query(
				"INSERT INTO intelligence_records SELECT 'buyer', item->>'id', item FROM jsonb_array_elements($1::jsonb) AS item ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data",
				[JSON.stringify(validated)],
			);
			return Response.json({ saved: validated.length, duplicates });
		}
		if (body.kind === "observation" || body.kind === "competitor") {
			const item = body.item;
			if (!item.sourceUrl || !item.name || !item.country)
				throw new Error("Name, country and public source URL required");
			domain(item.sourceUrl);
			const clean: Record<string, string | number> = {
				id: crypto.randomUUID(),
				collectedAt: new Date().toISOString(),
			};
			for (const [k, v] of Object.entries(item))
				if (
					[
						"name",
						"country",
						"product",
						"period",
						"unit",
						"method",
						"limitations",
						"sourceUrl",
						"channel",
						"price",
						"packaging",
						"promotion",
						"currency",
					].includes(k)
				)
					clean[k] = String(v).slice(0, 10000);
			if (body.kind === "observation") {
				if (
					!products.includes(item.product) ||
					!/^\d{4}-\d{2}-\d{2}$/.test(item.period) ||
					!item.unit ||
					!item.method ||
					!item.limitations
				)
					throw new Error(
						"Product, date, unit, method and limitations required",
					);
				if (!Number.isFinite(Number(item.value)) || Number(item.value) < 0)
					throw new Error("Nonnegative metric value required");
				clean.value = Number(item.value);
				clean.classification = "user-supplied-public-observation";
			}
			await db.query(
				"INSERT INTO intelligence_records VALUES ($1,$2,$3::jsonb)",
				[body.kind, clean.id, JSON.stringify(clean)],
			);
			return Response.json({ saved: 1 });
		}
		if (body.kind === "market") {
			const m = body.item;
			if (!m.name?.trim() || !m.language?.trim())
				throw new Error("Country and language required");
			const clean = {
				id: crypto.randomUUID(),
				name: String(m.name).slice(0, 100),
				language: String(m.language).slice(0, 100),
				values: [null, null, null, null, null, null],
				kind: "manual",
				note: "No verified market evidence yet.",
				updatedAt: new Date().toISOString(),
			};
			await db.query(
				"INSERT INTO intelligence_records VALUES ('market',$1,$2::jsonb)",
				[clean.id, JSON.stringify(clean)],
			);
			return Response.json(clean);
		}
		if (body.kind === "settings") {
			const w = body.item.weights;
			if (
				!Array.isArray(w) ||
				w.length !== 6 ||
				w.some(
					(v: unknown) => typeof v !== "number" || !Number.isFinite(v) || v < 0,
				) ||
				w.reduce((a: number, b: number) => a + b, 0) !== 100
			)
				throw new Error("Six nonnegative weights must sum to 100");
			await db.query(
				"INSERT INTO intelligence_records VALUES ('settings','default',$1::jsonb) ON CONFLICT(kind,id) DO UPDATE SET data=EXCLUDED.data",
				[
					JSON.stringify({
						weights: w,
						reminders: String(body.item.reminders ?? "").slice(0, 10000),
					}),
				],
			);
			return Response.json({ saved: true });
		}
		return Response.json({ error: "Unknown operation" }, { status: 400 });
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? e.message : "Invalid request" },
			{ status: 400 },
		);
	}
}
