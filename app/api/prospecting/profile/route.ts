import {
	prospectDB,
	oneProspect,
	addHistory,
	transaction,
} from "@/lib/prospecting/store";
import { safeURL } from "@/lib/prospecting/identity";
import { countryFor } from "@/lib/countries";
import type {
	ManualProfile,
	Claim,
	CorporateImport,
} from "@/lib/prospecting/types";
export async function GET(req: Request) {
	try {
		const lead = await oneProspect(
			new URL(req.url).searchParams.get("id") ?? "",
		);
		return lead
			? Response.json({ lead })
			: Response.json({ code: "NOT_FOUND" }, { status: 404 });
	} catch {
		return Response.json({ code: "DATABASE_ERROR" }, { status: 503 });
	}
}
export async function PATCH(req: Request) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json(
				{ error: "Cross-origin request rejected" },
				{ status: 403 },
			);
		const b = await req.json();
		if (typeof b.id !== "string") throw new Error("Customer ID required");
		const lead = await oneProspect(b.id);
		if (!lead || lead.mock || lead.mergedInto)
			throw new Error("Select an active real B2B candidate");
		const db = await prospectDB();
		const reviewer =
			typeof b.reviewer === "string" ? b.reviewer.trim().slice(0, 100) : "";
		if (!reviewer)
			throw new Error(
				"Reviewer name required; this is an operator attestation, not automated verification",
			);
		await transaction(db, async (c) => {
			const profile: ManualProfile = { ...(lead.intel?.manual ?? {}) };
			if (b.action === "review-contact") {
				const row = (
					await c.query(
						"SELECT data FROM discovery_contacts WHERE id=$1 AND lead_id=$2",
						[b.contactId, b.id],
					)
				).rows[0];
				if (!row) throw new Error("Contact not found");
				if (typeof b.note !== "string" || b.note.trim().length < 10)
					throw new Error(
						"Record how ownership was checked (at least 10 characters)",
					);
				const contact = {
					...row.data,
					identity: "manually-confirmed",
					reviewer,
					reviewedAt: new Date().toISOString(),
					reviewNote: b.note.trim().slice(0, 2000),
				};
				if (contact.kind === "whatsapp" && contact.format === "valid")
					contact.directUrl =
						"https://wa.me/" + contact.value.replace(/\D/g, "");
				await c.query(
					"UPDATE discovery_contacts SET data=$3::jsonb WHERE id=$1 AND lead_id=$2",
					[b.contactId, b.id, JSON.stringify(contact)],
				);
				await addHistory(c, b.id, "manual-contact-review", {
					contactId: b.contactId,
					reviewer,
					note: contact.reviewNote,
					availability: "not-checked",
				});
				return;
			}
			if (b.action === "profile") {
				for (const k of [
					"country",
					"city",
					"companyName",
					"officialWebsite",
				] as const)
					if (typeof b[k] === "string") {
						if (k === "country" && b[k] && !countryFor(b[k]))
							throw new Error("Choose an ISO country");
						if (k === "officialWebsite" && b[k] && !safeURL(b[k]))
							throw new Error("Valid public HTTP(S) company website required");
						profile[k] = b[k]
							.trim()
							.slice(0, k === "officialWebsite" ? 2000 : 200);
					}
				if (typeof b.excludedConsumer === "boolean")
					profile.excludedConsumer = b.excludedConsumer;
			} else if (b.action === "add-claim") {
				const claim = b.claim;
				if (
					!claim ||
					!["product", "business", "oem", "activity"].includes(claim.key) ||
					!["fact", "inference"].includes(claim.state) ||
					typeof claim.statement !== "string" ||
					!claim.statement.trim() ||
					typeof claim.quote !== "string" ||
					!claim.quote.trim() ||
					!safeURL(claim.sourceUrl)
				)
					throw new Error(
						"Claim needs a category, state, statement, exact public quote and source URL",
					);
				const safe: Claim = {
					key: claim.key,
					state: claim.state,
					statement: claim.statement.slice(0, 2000),
					quote: claim.quote.slice(0, 4000),
					sourceUrl: safeURL(claim.sourceUrl)!.href,
					collectedAt: new Date().toISOString(),
					reviewer,
				};
				profile.claims = [...(profile.claims ?? []), safe];
			} else if (b.action === "add-import") {
				const r = b.record;
				if (
					b.companyMatchConfirmed !== true ||
					!r ||
					!safeURL(r.sourceUrl) ||
					typeof r.companyIdentifier !== "string" ||
					!r.companyIdentifier.trim() ||
					typeof r.provider !== "string" ||
					!r.provider.trim() ||
					!/^\d{4}(-\d{2})?$/.test(r.period) ||
					!/^\d{4,10}$/.test(r.hsCode) ||
					typeof r.description !== "string" ||
					!r.description.trim() ||
					!["amount", "quantity"].some(
						(k) =>
							typeof r[k] === "number" && Number.isFinite(r[k]) && r[k] >= 0,
					) ||
					["amount", "quantity"].some(
						(k) =>
							r[k] !== null &&
							r[k] !== undefined &&
							(typeof r[k] !== "number" || !Number.isFinite(r[k]) || r[k] < 0),
					) ||
					(r.amount !== null &&
						r.amount !== undefined &&
						!/^[A-Z]{3}$/.test(r.currency)) ||
					(r.quantity !== null &&
						r.quantity !== undefined &&
						!r.unit?.trim()) ||
					!r.scope?.trim()
				)
					throw new Error(
						"Company-linked source, identifier, period, HS, description, scope and a valid amount/currency or quantity/unit are required. National totals are not company records.",
					);
				const record: CorporateImport = {
					id: crypto.randomUUID(),
					companyIdentifier: r.companyIdentifier.slice(0, 200),
					provider: r.provider.slice(0, 100),
					sourceUrl: safeURL(r.sourceUrl)!.href,
					period: r.period,
					hsCode: r.hsCode,
					description: r.description.slice(0, 2000),
					amount: r.amount ?? null,
					currency: String(r.currency ?? "").slice(0, 3),
					quantity: r.quantity ?? null,
					unit: String(r.unit ?? "").slice(0, 50),
					scope: r.scope.slice(0, 2000),
					reviewer,
					verifiedAt: new Date().toISOString(),
				};
				profile.corporateImports = [
					...(profile.corporateImports ?? []),
					record,
				];
			} else throw new Error("Unknown action");
			await c.query(
				"INSERT INTO discovery_profiles VALUES($1,$2::jsonb) ON CONFLICT(lead_id) DO UPDATE SET data=EXCLUDED.data",
				[lead.id, JSON.stringify(profile)],
			);
			await addHistory(c, lead.id, "manual-profile-review", {
				action: b.action,
				reviewer,
				profile,
			});
		});
		return Response.json({ lead: await oneProspect(b.id) });
	} catch (e) {
		return Response.json(
			{ error: e instanceof Error ? e.message : "Unable to save review" },
			{ status: 400 },
		);
	}
}
