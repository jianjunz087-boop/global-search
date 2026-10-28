import { canonicalCompany } from "@/lib/prospecting/identity";
import { allProspects } from "@/lib/prospecting/store";
import {
	prospectDB,
	transaction,
	addHistory,
	oneProspect,
} from "@/lib/prospecting/store";
export async function POST(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin request rejected" },
				{ status: 403 },
			);
		const b = await req.json();
		if (
			typeof b.sourceId !== "string" ||
			typeof b.targetId !== "string" ||
			b.sourceId === b.targetId ||
			typeof b.reason !== "string" ||
			b.reason.trim().length < 10
		)
			throw new Error(
				"Select two different company records and explain the common identity (10+ characters)",
			);
		const db = await prospectDB();
		await transaction(db, async (c) => {
			const rows = (
				await c.query("SELECT data FROM leads WHERE id=ANY($1::text[])", [
					[b.sourceId, b.targetId],
				])
			).rows.map((r) => r.data);
			const source = rows.find((l) => l.id === b.sourceId),
				target = rows.find((l) => l.id === b.targetId);
			if (
				!source ||
				!target ||
				source.mock ||
				target.mock ||
				source.mergedInto ||
				target.mergedInto
			)
				throw new Error("Only active real candidates can be merged");
			await c.query("UPDATE leads SET data=data || $2::jsonb WHERE id=$1", [
				source.id,
				JSON.stringify({
					mergedInto: target.id,
					mergedAt: new Date().toISOString(),
				}),
			]);
			for (const table of [
				"discovery_sources",
				"discovery_contacts",
				"discovery_history",
			])
				await c.query(`UPDATE ${table} SET lead_id=$2 WHERE lead_id=$1`, [
					source.id,
					target.id,
				]);
			const profiles = (
				await c.query(
					"SELECT lead_id,data FROM discovery_profiles WHERE lead_id=ANY($1::text[])",
					[[source.id, target.id]],
				)
			).rows;
			const a = profiles.find((r) => r.lead_id === source.id)?.data ?? {},
				t = profiles.find((r) => r.lead_id === target.id)?.data ?? {};
			await c.query(
				"INSERT INTO discovery_profiles VALUES($1,$2::jsonb) ON CONFLICT(lead_id) DO UPDATE SET data=EXCLUDED.data",
				[
					target.id,
					JSON.stringify({
						...a,
						...t,
						claims: [...(t.claims ?? []), ...(a.claims ?? [])],
						corporateImports: [
							...(t.corporateImports ?? []),
							...(a.corporateImports ?? []),
						],
					}),
				],
			);
			await addHistory(c, target.id, "manual-company-merge", {
				reason: b.reason.trim().slice(0, 2000),
				sourceRecord: source,
				targetRecord: target,
				sourceProfile: a,
				targetProfile: t,
				note: "Original source record and both CRM states retained. No contact availability asserted.",
			});
		});
		return Response.json({ lead: await oneProspect(b.targetId) });
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? e.message : "Unable to merge" },
			{ status: 400 },
		);
	}
}

export async function GET() {
	try {
		const leads = (await allProspects()).filter((l) => !l.mock);
		const groups = new Map<string, string[]>();
		for (const lead of leads) {
			const key = canonicalCompany(
				lead.intel?.manual.officialWebsite || lead.website,
			);
			groups.set(key, [...(groups.get(key) ?? []), lead.id]);
		}
		return Response.json({
			groups: [...groups]
				.filter(([key, ids]) => key && ids.length > 1)
				.map(([identity, ids]) => ({ identity, ids })),
			method:
				"Exact normalized company domain/account candidates only; no automatic deletion or ownership assertion.",
		});
	} catch {
		return Response.json(
			{ error: "Unable to inspect duplicates" },
			{ status: 503 },
		);
	}
}
