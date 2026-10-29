import { qualifyBusiness } from "./qualification";
import {
	extractPublicContacts,
	scopeContact,
	combineContactEvidence,
} from "./contacts";
import { database } from "../db";
import type { Lead } from "../leads";
import { canonicalCompany, stableID } from "./identity";
import { analyzeLead } from "./analysis";
import {
	defaultWeights,
	type ContactEvidence,
	type ManualProfile,
	type ScoreWeights,
	type SearchTask,
	type SourceEvidence,
} from "./types";
export type ProspectDB = Awaited<ReturnType<typeof database>>;
export async function prospectDB() {
	const db = await database();
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_tasks (id text PRIMARY KEY,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_sources (id text PRIMARY KEY,lead_id text NOT NULL,data jsonb NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_contacts (id text PRIMARY KEY,lead_id text NOT NULL,data jsonb NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_profiles (lead_id text PRIMARY KEY,data jsonb NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_history (id text PRIMARY KEY,lead_id text NOT NULL,kind text NOT NULL,data jsonb NOT NULL,created_at timestamptz NOT NULL DEFAULT now())",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_cache (id text PRIMARY KEY,data jsonb NOT NULL,expires_at timestamptz NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_limits (id text PRIMARY KEY,requested_at timestamptz NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_settings (id text PRIMARY KEY,data jsonb NOT NULL)",
	);
	await db.query(
		"CREATE TABLE IF NOT EXISTS discovery_resources (id text PRIMARY KEY,data jsonb NOT NULL)",
	);
	return db;
}
let writeTail: Promise<unknown> = Promise.resolve();
export async function transaction<T>(
	db: ProspectDB,
	fn: (client: Awaited<ReturnType<ProspectDB["connect"]>>) => Promise<T>,
): Promise<T> {
	const operation = writeTail
		.catch(() => {})
		.then(async () => {
			const c = await db.connect();
			try {
				await c.query("BEGIN");
				if (!process.env.DESKTOP_DATA_DIR)
					await c.query("SELECT pg_advisory_xact_lock(894314)");
				const result = await fn(c);
				await c.query("COMMIT");
				return result;
			} catch (e) {
				await c.query("ROLLBACK");
				throw e;
			} finally {
				c.release();
			}
		});
	writeTail = operation;
	return operation;
}
export async function addHistory(
	db: Pick<ProspectDB, "query">,
	leadID: string,
	kind: string,
	data: Record<string, unknown>,
) {
	await db.query(
		"INSERT INTO discovery_history VALUES($1,$2,$3,$4::jsonb,now())",
		[crypto.randomUUID(), leadID, kind, JSON.stringify(data)],
	);
}
export async function readWeights(db: ProspectDB): Promise<ScoreWeights> {
	return (
		(await db.query("SELECT data FROM discovery_settings WHERE id='weights'"))
			.rows[0]?.data ?? defaultWeights
	);
}
export async function decorateLeads(
	db: ProspectDB,
	leads: Lead[],
	includeHistory = false,
): Promise<Lead[]> {
	const ids = leads.map((l) => l.id);
	if (!ids.length) return [];
	const legacyRows = leads
		.filter((l) => !l.mock && !l.mergedInto && (l.whatsapp || l.email))
		.flatMap((l) =>
			extractPublicContacts({
				text: `Email: ${l.email} WhatsApp: ${l.whatsapp ? "+" + l.whatsapp.replace(/\D/g, "") : ""}`,
				sourceUrl: l.whatsappSource || l.source,
				website: l.website,
				method:
					"Legacy stored contact field; not newly collected or independently authenticated",
				collectedAt: l.whatsappCheckedAt || "Unknown (legacy record)",
			}).map((contact) => ({ lead_id: l.id, ...scopeContact(contact, l.id) })),
		);
	if (legacyRows.length)
		await db.query(
			"INSERT INTO discovery_contacts SELECT item->>'id',item->>'lead_id',item-'lead_id' FROM jsonb_array_elements($1::jsonb) item ON CONFLICT(id) DO NOTHING",
			[JSON.stringify(legacyRows)],
		);

	const [src, contacts, profiles, weights, history] = await Promise.all([
		db.query(
			"SELECT lead_id,data FROM discovery_sources WHERE lead_id=ANY($1::text[])",
			[ids],
		),
		db.query(
			"SELECT lead_id,data FROM discovery_contacts WHERE lead_id=ANY($1::text[])",
			[ids],
		),
		db.query(
			"SELECT lead_id,data FROM discovery_profiles WHERE lead_id=ANY($1::text[])",
			[ids],
		),
		readWeights(db),
		includeHistory
			? db.query(
					"SELECT id,lead_id,kind,data,created_at FROM discovery_history WHERE lead_id=ANY($1::text[]) ORDER BY created_at DESC LIMIT 200",
					[ids],
				)
			: Promise.resolve({ rows: [] }),
	]);
	return leads.map((l) => {
		const sources: SourceEvidence[] = src.rows
			.filter((r) => r.lead_id === l.id)
			.map((r) => r.data);
		const cs: ContactEvidence[] = contacts.rows
			.filter((r) => r.lead_id === l.id)
			.map((r) => r.data);

		const manual: ManualProfile =
			profiles.rows.find((r) => r.lead_id === l.id)?.data ?? {};
		return {
			...l,
			intel: {
				sources,
				contacts: combineContactEvidence(cs),
				manual,
				analysis: analyzeLead(l, sources, cs, manual, weights),
				targetCountry: l.targetCountry ?? sources[0]?.targetCountry ?? "",
				mergedInto: l.mergedInto,
				history: includeHistory
					? history.rows
							.filter((r) => r.lead_id === l.id)
							.map((r) => ({
								id: r.id,
								kind: r.kind,
								data: r.data,
								createdAt: new Date(r.created_at).toISOString(),
							}))
					: undefined,
			},
		};
	});
}
export async function allProspects() {
	const db = await prospectDB();
	const leads = (await db.query("SELECT data FROM leads ORDER BY id")).rows
		.map((r) => r.data)
		.filter((l) => !l.mergedInto);
	return decorateLeads(db, leads);
}
export async function oneProspect(id: string) {
	const db = await prospectDB();
	const row = (await db.query("SELECT data FROM leads WHERE id=$1", [id]))
		.rows[0];
	if (!row) return null;
	return (await decorateLeads(db, [row.data], true))[0];
}
export async function persistDiscovery(
	db: ProspectDB,
	items: SourceEvidence[],
	contacts: ContactEvidence[],
	targetCountry: string,
) {
	return transaction(db, async (c) => {
		const existing: Lead[] = (await c.query("SELECT data FROM leads")).rows.map(
			(r) => r.data,
		);
		const byIdentity = new Map<string, Lead>();
		for (const original of existing) {
			let resolved = original;
			for (let n = 0; resolved.mergedInto && n < 20; n++) {
				const next = existing.find((l) => l.id === resolved.mergedInto);
				if (!next) break;
				resolved = next;
			}
			byIdentity.set(canonicalCompany(original.website), resolved);
		}
		const profiles = (
			await c.query("SELECT lead_id,data FROM discovery_profiles")
		).rows;
		const knownContacts = (
			await c.query(
				"SELECT lead_id,data FROM discovery_contacts WHERE data->>'identity'='manually-confirmed'",
			)
		).rows;
		for (const row of profiles) {
			const lead = existing.find((l) => l.id === row.lead_id);
			if (lead && !lead.mergedInto && row.data.officialWebsite)
				byIdentity.set(canonicalCompany(row.data.officialWebsite), lead);
		}
		for (const row of knownContacts) {
			const lead = existing.find((l) => l.id === row.lead_id);
			if (
				lead &&
				!lead.mergedInto &&
				["instagram", "telegram", "facebook", "website"].includes(row.data.kind)
			)
				byIdentity.set(canonicalCompany(row.data.value), lead);
		}
		const ids = new Set<string>();
		let added = 0,
			merged = 0,
			excluded = 0;
		const rejected: { url: string; title: string; reasons: string[] }[] = [];
		for (const source of items) {
			if (source.resourceOnly) {
				await c.query(
					"INSERT INTO discovery_resources VALUES($1,$2::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
					[
						stableID(source.engine + "|" + source.url, "resource-"),
						JSON.stringify(source),
					],
				);
				continue;
			}
			const qualification = qualifyBusiness(source);
			if (!qualification.accepted) {
				excluded++;
				rejected.push({
					url: source.url,
					title: source.title,
					reasons: qualification.reasons,
				});
				continue;
			}
			const temporary: Lead = {
				id: "",
				name: source.title,
				country: "Not verified",
				targetCountry,
				type: "Unverified B2B candidate",
				website: source.url,
				email: "",
				whatsapp: "",
				source: source.url,
				score: 0,
				status: "New",
				note: "Source title, not a verified company name. Country is a search target only.",
				nextFollowUp: "",
				tags: ["Needs verification"],
				mock: false,
			};
			const assessment = analyzeLead(temporary, [source], []);
			if (assessment.b2b === "consumer-excluded") {
				excluded++;
				continue;
			}
			const identity = canonicalCompany(source.url);
			if (!identity) continue;
			let lead = byIdentity.get(identity);
			if (!lead) {
				lead = { ...temporary, id: stableID(identity) };
				await c.query(
					"INSERT INTO leads VALUES($1,$2::jsonb) ON CONFLICT DO NOTHING",
					[lead.id, JSON.stringify(lead)],
				);
				byIdentity.set(identity, lead);
				added++;
			} else merged++;
			const sourceID = stableID(
				lead.id + "|" + source.engine + "|" + source.query + "|" + source.url,
				"source-",
			);
			await c.query(
				"INSERT INTO discovery_sources VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
				[sourceID, lead.id, JSON.stringify(source)],
			);
			ids.add(lead.id);
			for (const raw of contacts.filter((x) => x.sourceUrl === source.url)) {
				const contact = scopeContact(raw, lead.id);
				await c.query(
					"INSERT INTO discovery_contacts VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET data=discovery_contacts.data || jsonb_build_object('lastSeenAt',$4::text)",
					[contact.id, lead.id, JSON.stringify(contact), contact.collectedAt],
				);
			}
			await addHistory(c, lead.id, "search-source", {
				engine: source.engine,
				query: source.query,
				url: source.url,
				originalUrl: source.originalUrl ?? source.url,
				collectedAt: source.collectedAt,
			});
		}
		return {
			ids: [...ids],
			resources: items.filter((s) => s.resourceOnly),
			rejected,
			added,
			merged,
			excluded,
		};
	});
}
export async function saveTask(db: ProspectDB, task: SearchTask) {
	await db.query(
		"INSERT INTO discovery_tasks VALUES($1,$2::jsonb,now()) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
		[task.id, JSON.stringify(task)],
	);
}
