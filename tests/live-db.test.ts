import { test } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { createCollectionHandler } from "../lib/intelligence/collection";
test("PGlite stores API records atomically, caches queries and enforces persistent collection guard", async () => {
	const db = new PGlite();
	await db.waitReady;
	try {
		await db.exec(
			"CREATE TABLE intelligence_records(kind text,id text,data jsonb,PRIMARY KEY(kind,id)); CREATE TABLE intelligence_collection_guard(id text PRIMARY KEY,requested_at timestamptz NOT NULL);",
		);
		let calls = 0;
		const handler = createCollectionHandler({
			database: async () => ({
				query: async (sql, params) => {
					const r = await db.query(sql, params);
					return { rows: r.rows, rowCount: r.rows.length };
				},
			}),
			key: () => "SYNTHETIC-TEST-KEY",
			fetcher: async () => {
				calls++;
				return Response.json({
					interest_over_time: {
						timeline_data: [
							{
								timestamp: String(Math.floor(Date.now() / 1000) - 86400),
								values: [{ extracted_value: 42, value: "42" }],
							},
						],
					},
				});
			},
		});
		const request = (keyword = "SYNTHETIC TEST QUERY") =>
			new Request("http://localhost/api/intelligence/collect", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					source: "google-trends",
					country: "United States",
					product: "DIY Cluster Lashes",
					keyword,
					range: "today 12-m",
				}),
			});
		const first = await handler(request());
		assert.equal(first.status, 200);
		assert.equal((await first.json()).received, 1);
		const stored = await db.query<{
			data: { value: number; sourceId: string };
		}>("SELECT data FROM intelligence_records WHERE kind='observation'");
		assert.equal(stored.rows[0].data.value, 42);
		assert.equal(stored.rows[0].data.sourceId, "google-trends");
		assert.equal((await (await handler(request())).json()).cached, true);
		assert.equal(calls, 1);
		assert.equal(
			(await handler(request("ANOTHER SYNTHETIC QUERY"))).status,
			429,
		);
		assert.equal(calls, 1);
		const all = await db.query("SELECT data FROM intelligence_records");
		assert.ok(!JSON.stringify(all.rows).includes("SYNTHETIC-TEST-KEY"));
	} finally {
		await db.close();
	}
});
