import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { database, closeDatabase } from "../lib/db";
import {
	prospectDB,
	oneProspect,
	persistDiscovery,
} from "../lib/prospecting/store";
import {
	createTask,
	pumpTasks,
	taskResponse,
} from "../lib/prospecting/service";
import { PATCH as review } from "../app/api/prospecting/profile/route";
import { POST as merge } from "../app/api/prospecting/merge/route";
import { POST as settings } from "../app/api/prospecting/settings/route";
import { GET as exportFile } from "../app/api/prospecting/export/route";
import { POST as importFile } from "../app/api/prospecting/import/route";
process.env.DESKTOP_DATA_DIR = mkdtempSync(
	join(tmpdir(), "baihua-upgrade-regression-"),
);
after(async () => {
	await closeDatabase();
});
const request = (url: string, body: unknown) =>
	new Request("http://localhost" + url, {
		method: "POST",
		headers: { "Content-Type": "application/json", host: "localhost" },
		body: JSON.stringify(body),
	});
test("additive migrations, parallel partial search, caching, review, merge and exports preserve historical CRM records", async () => {
	const old = await database();
	const original = {
		id: "legacy-sentinel",
		name: "SYNTHETIC DATABASE FIXTURE — not an actual business",
		country: "Not verified",
		type: "Unverified",
		website: "https://supplier.example",
		email: "legacy@supplier.example",
		whatsapp: "447700900123",
		source: "https://supplier.example",
		score: 0,
		status: "Negotiating",
		note: "IMPORTANT ORIGINAL CRM NOTE",
		nextFollowUp: "2026-12-01",
		tags: [],
		mock: false,
		customHistoricalField: { must: "remain" },
	};
	await old.query("INSERT INTO leads VALUES($1,$2::jsonb)", [
		original.id,
		JSON.stringify(original),
	]);
	const before = (await old.query("SELECT data FROM leads ORDER BY id")).rows;
	const db = await prospectDB();
	await prospectDB();
	assert.deepEqual(
		(await db.query("SELECT data FROM leads ORDER BY id")).rows,
		before,
	);
	const directory = await persistDiscovery(
		db,
		[
			{
				engine: "google",
				query: "SYNTHETIC DIRECTORY QUERY",
				url: "https://directory.example/list",
				title: "Top 5 TEST Suppliers — not a company",
				snippet: "Wholesale directory fixture",
				platform: "directories",
				resourceOnly: true,
				targetCountry: "Russia",
				collectedAt: new Date().toISOString(),
			},
		],
		[],
		"Russia",
	);
	assert.equal(directory.ids.length, 0);
	assert.equal(
		(await db.query("SELECT id FROM discovery_resources")).rows.length,
		1,
	);
	const previousFetch = globalThis.fetch,
		previousKey = process.env.SERPAPI_API_KEY;
	process.env.SERPAPI_API_KEY = "SYNTHETIC-TEST-ONLY-KEY";
	let calls = 0;
	globalThis.fetch = async (input) => {
		const u = new URL(String(input));
		assert.equal(u.hostname, "serpapi.com");
		calls++;
		if (u.searchParams.get("engine") === "yandex")
			return new Response("", { status: 403 });
		return Response.json({
			organic_results: [
				{
					title: original.name,
					link: "https://www.supplier.example/contact?utm_source=test",
					snippet:
						"Synthetic test text: eyelash wholesale distributor, WhatsApp: +44 7700 900123",
				},
			],
		});
	};
	try {
		const task = await createTask({
			keyword: "synthetic lash wholesale",
			country: "Russia",
			engine: "both",
			filters: { grade: "C" },
		});
		await pumpTasks();
		let result = await taskResponse(task.id);
		assert.equal(result?.task.state, "partial");
		assert.equal(result?.task.errors[0].engine, "yandex");
		assert.equal(result?.task.errors[0].code, "ACCESS_DENIED");
		assert.deepEqual(result?.ids, [original.id]);
		assert.equal(calls, 2);
		assert.equal(result?.task.usage, 2);
		assert.equal(result?.task.savedFilter?.grade, "C");
		assert.deepEqual(
			(await db.query("SELECT data FROM leads WHERE id=$1", [original.id]))
				.rows[0].data,
			original,
		);
		const again = await createTask({
			keyword: "synthetic lash wholesale",
			country: "Russia",
			engine: "google",
		});
		await pumpTasks();
		result = await taskResponse(again.id);
		assert.equal(result?.task.cacheHit, true);
		assert.equal(result?.task.usage, 0);
		assert.equal(calls, 2);
		const profile = await oneProspect(original.id);
		const contact = profile?.intel?.contacts.find((c) => c.kind === "whatsapp");
		assert.ok(contact);
		assert.equal(contact.format, "valid");
		assert.equal(contact.identity, "unverified");
		assert.equal(
			profile?.intel?.analysis.components.find((c) => c.key === "imports")
				?.earned,
			0,
		);
		const r = await review(
			request("/api/prospecting/profile", {
				id: original.id,
				action: "review-contact",
				contactId: contact.id,
				reviewer: "TEST REVIEWER",
				note: "Synthetic test public source ownership match only",
			}),
		);
		assert.equal(r.status, 200);
		assert.equal(
			(await r.json()).lead.intel.contacts.find((c: any) => c.id === contact.id)
				.identity,
			"manually-confirmed",
		);
		const invalidImport = await review(
			request("/api/prospecting/profile", {
				id: original.id,
				action: "add-import",
				reviewer: "TEST",
				companyMatchConfirmed: false,
				record: {},
			}),
		);
		assert.equal(invalidImport.status, 400);
		const save = await settings(
			request("/api/prospecting/settings", {
				action: "save-setup",
				query: {
					engine: "yandex",
					country: "Poland",
					keyword: "rzęsy hurtownia",
					language: "auto",
				},
				filters: { grade: "B" },
			}),
		);
		assert.equal(save.status, 200);
		const add = await importFile(
			request("/api/prospecting/import", {
				rows: [
					{
						name: "SYNTHETIC SECOND RECORD — no actual business",
						website: "https://other.example",
						source: "https://other.example/contact",
						type: "Wholesaler",
						country: "Poland",
						note: "SECOND ORIGINAL NOTE",
					},
				],
			}),
		);
		assert.equal(add.status, 200);
		assert.equal((await add.json()).added, 1);
		const target = (
			await db.query(
				"SELECT data FROM leads WHERE data->>'website'='https://other.example/'",
			)
		).rows[0]?.data;
		assert.ok(target);
		const merged = await merge(
			request("/api/prospecting/merge", {
				sourceId: original.id,
				targetId: target.id,
				reason:
					"Synthetic regression test explicitly joins these fixture aliases",
			}),
		);
		assert.equal(merged.status, 200);
		const archived = (
			await db.query("SELECT data FROM leads WHERE id=$1", [original.id])
		).rows[0].data;
		assert.equal(archived.note, original.note);
		assert.equal(archived.customHistoricalField.must, "remain");
		assert.equal(archived.mergedInto, target.id);
		const targetProfile = await oneProspect(target.id);
		assert.ok(targetProfile?.intel?.sources.length);
		assert.ok(targetProfile?.intel?.contacts.length);
		assert.ok(
			targetProfile?.intel?.history?.some(
				(h) => h.kind === "manual-company-merge",
			),
		);
		// Rediscovery of the archived domain must resolve to the merged target, never recreate the old customer.
		const rediscovered = await createTask({
			keyword: "synthetic lash wholesale",
			country: "Russia",
			engine: "google",
		});
		await pumpTasks();
		assert.deepEqual((await taskResponse(rediscovered.id))?.ids, [target.id]);
		const exported = await exportFile(
			new Request(
				"http://localhost/api/prospecting/export?format=csv&ids=" + target.id,
			),
		);
		assert.equal(exported.status, 200);
		const text = await exported.text();
		assert.match(text, /Sources JSON/);
		assert.match(text, /manually-confirmed/);
		assert.match(text, /暂无企业级进口数据/);
		assert.match(text, /IMPORTANT ORIGINAL CRM NOTE/);
		assert.ok(!text.includes("SYNTHETIC-TEST-ONLY-KEY"));
		const xlsx = await exportFile(
			new Request(
				"http://localhost/api/prospecting/export?format=xlsx&ids=" + target.id,
			),
		);
		assert.equal(xlsx.status, 200);
		assert.ok((await xlsx.arrayBuffer()).byteLength > 1000);
		delete process.env.SERPAPI_API_KEY;
		const prior = (
			await db.query("SELECT data FROM leads WHERE id=$1", [target.id])
		).rows[0].data;
		const failed = await createTask(
			{ companyId: target.id, intent: "whatsapp", engine: "both" },
			"enrichment",
		);
		await pumpTasks();
		const failure = await taskResponse(failed.id);
		assert.equal(failure?.task.state, "failed");
		assert.ok(failure?.task.errors.every((e) => e.code === "MISSING_API_KEY"));
		const retained = (
			await db.query("SELECT data FROM leads WHERE id=$1", [target.id])
		).rows[0].data;
		assert.equal(retained.whatsappLookupStatus, "failed");
		assert.equal(retained.whatsappCheckedAt, prior.whatsappCheckedAt);
		assert.equal(retained.note, prior.note);
	} finally {
		globalThis.fetch = previousFetch;
		if (previousKey === undefined) delete process.env.SERPAPI_API_KEY;
		else process.env.SERPAPI_API_KEY = previousKey;
	}
});
