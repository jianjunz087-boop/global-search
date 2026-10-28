import { prospectDB, transaction, addHistory } from "@/lib/prospecting/store";
import {
	canonicalCompany,
	stableID,
	safeURL,
	platformOf,
} from "@/lib/prospecting/identity";
import {
	extractPublicContacts,
	scopeContact,
} from "@/lib/prospecting/contacts";
export async function POST(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin request rejected" },
				{ status: 403 },
			);
		const b = await req.json();
		if (!Array.isArray(b.rows) || b.rows.length > 500)
			throw new Error("Maximum 500 rows per import");
		const rows = b.rows.map((r: any) => {
			const name = r.name || r["Company / 公司"],
				website = r.website || r.Website,
				source = r.source || r.Source;
			if (
				typeof name !== "string" ||
				!name.trim() ||
				!safeURL(website) ||
				!safeURL(source) ||
				![
					"Importer",
					"Wholesaler",
					"Distributor",
					"Brand",
					"Beauty supplier",
					"Unverified B2B candidate",
					"Unverified search result",
				].includes(r.type || r["Customer type"])
			)
				throw new Error(
					"Each row needs name, website, public source and a B2B type (Importer/Wholesaler/Distributor/Brand/Beauty supplier)",
				);
			return {
				name: name.slice(0, 200),
				website: safeURL(website)!.href,
				source: safeURL(source)!.href,
				type: r.type || r["Customer type"],
				country: String(r.country || r["Search target country"] || ""),
				email: String(r.email || r.Email || ""),
				whatsapp: String(r.whatsapp || r.WhatsApp || ""),
				note: String(r.note || r.Notes || "").slice(0, 10000),
				status: [
					"New",
					"Contacted",
					"Qualified",
					"Negotiating",
					"Won",
					"Lost",
				].includes(r.status || r["CRM status"])
					? r.status || r["CRM status"]
					: "New",
				nextFollowUp: /^\d{4}-\d{2}-\d{2}$/.test(
					r.nextFollowUp || r["Next follow-up"] || "",
				)
					? r.nextFollowUp || r["Next follow-up"]
					: "",
				phone: String(r.phone || ""),
			};
		});
		const db = await prospectDB();
		let added = 0,
			duplicates = 0;
		await transaction(db, async (c) => {
			const existing = (await c.query("SELECT data FROM leads")).rows.map(
				(r) => r.data,
			);
			const ids = new Map(
				existing.map((l) => [
					canonicalCompany(l.website),
					l.mergedInto || l.id,
				]),
			);
			for (const row of rows) {
				const key = canonicalCompany(row.website);
				let id = ids.get(key);
				if (!id) {
					id = stableID(key);
					await c.query(
						"INSERT INTO leads VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING",
						[
							id,
							JSON.stringify({
								id,
								name: row.name,
								country: "Not verified",
								targetCountry: row.country,
								type: row.type,
								website: row.website,
								source: row.source,
								email: "",
								whatsapp: "",
								score: 0,
								status: row.status,
								note: row.note,
								nextFollowUp: row.nextFollowUp,
								tags: ["Operator import · unverified"],
								mock: false,
							}),
						],
					);
					ids.set(key, id);
					added++;
				} else duplicates++;
				const source = {
					engine: "manual",
					query:
						"Operator CSV/XLSX import; source and company identity not automatically checked",
					url: row.source,
					title: row.name,
					snippet: "User supplied business type: " + row.type,
					collectedAt: new Date().toISOString(),
					platform: platformOf(row.source),
					targetCountry: row.country,
				};
				await c.query(
					"INSERT INTO discovery_sources VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING",
					[stableID(id + row.source, "source-"), id, JSON.stringify(source)],
				);
				const contacts = extractPublicContacts({
					text: `Email: ${row.email} WhatsApp: ${row.whatsapp} Phone: ${row.phone}`,
					sourceUrl: row.source,
					website: row.website,
					method: "Operator-imported contact; source must be manually reviewed",
				});
				for (const raw of contacts) {
					const contact = scopeContact(raw, id);
					await c.query(
						"INSERT INTO discovery_contacts VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO NOTHING",
						[contact.id, id, JSON.stringify(contact)],
					);
				}
				await addHistory(c, id, "operator-import", {
					source: row.source,
					declaredCountry: row.country,
					declaredType: row.type,
					note: "Import does not assert company identity, country or WhatsApp availability.",
				});
			}
		});
		return Response.json({ added, duplicates });
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? e.message : "Import failed" },
			{ status: 400 },
		);
	}
}
