import { countryFor } from "../countries";
import type { CountryCode } from "libphonenumber-js";
import type { Lead } from "../leads";
import { createSearchAdapters, DiscoveryError } from "./providers";
import { discoveryText, validateDiscovery } from "./queries";
import {
	contactsFromSources,
	scopeContact,
	contactsFromHTML,
	bestPublicWhatsApp,
} from "./contacts";
import { collectWebsitePages } from "./crawler";
import { stableID, researchResource } from "./identity";
import {
	prospectDB,
	saveTask,
	persistDiscovery,
	decorateLeads,
	oneProspect,
	addHistory,
	transaction,
} from "./store";
import type { SearchTask, SourceEvidence } from "./types";
const runtime = globalThis as typeof globalThis & {
	prospectPump?: Promise<void>;
};
export async function createTask(
	body: any,
	kind: SearchTask["kind"] = "search",
) {
	const query = validateDiscovery(body);
	const task: SearchTask = {
		id: crypto.randomUUID(),
		kind,
		state: "queued",
		query,
		createdAt: new Date().toISOString(),
		attempts: 0,
		usage: 0,
		errors: [],
		savedFilter:
			body.filters && typeof body.filters === "object"
				? Object.fromEntries(
						Object.entries(body.filters)
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
				: undefined,
	};
	if (kind === "enrichment" && !query.companyId)
		throw new Error("INVALID_INPUT");
	if (kind === "enrichment") {
		const lead = await oneProspect(query.companyId!);
		if (
			!lead ||
			lead.mock ||
			lead.mergedInto ||
			lead.intel?.analysis.b2b === "consumer-excluded" ||
			(researchResource(lead.website, lead.name) &&
				!lead.intel?.manual.officialWebsite)
		)
			throw new Error("INVALID_INPUT");
		task.result = {
			includeWebsite:
				body.includeWebsite === true && body.officialWebsiteConfirmed === true,
		};
	}
	const db = await prospectDB();
	await saveTask(db, task);
	void pumpTasks();
	return task;
}
async function runTask(task: SearchTask) {
	const db = await prospectDB();
	let cacheHits = 0;
	const websiteFailures: string[] = [];
	let websitePagesCount = 0;
	try {
		const lead = task.query.companyId
			? await oneProspect(task.query.companyId)
			: null;
		if (task.kind === "enrichment" && !lead)
			throw new Error("Customer no longer exists");
		const text = discoveryText(
			task.query,
			lead
				? {
						...lead,
						name: lead.intel?.manual.companyName || lead.name,
						website: lead.intel?.manual.officialWebsite || lead.website,
					}
				: undefined,
		);
		const adapters = createSearchAdapters({
			googleKey: process.env.SERPAPI_API_KEY,
			yandexKey: process.env.YANDEX_SERPAPI_KEY,
			fetcher: (...args) => fetch(...args),
			onAttempt: async () => {
				task.usage++;
				task.attempts++;
				await saveTask(db, task);
			},
		});
		const engines =
			task.query.engine === "both"
				? (["google", "yandex"] as const)
				: [task.query.engine];
		const settled = await Promise.allSettled(
			engines.map(async (engine) => {
				const cacheID = stableID(
					JSON.stringify({
						engine,
						text,
						language: task.query.language,
						region: task.query.region,
						limit: task.query.limit,
						page: task.query.page,
					}),
					"cache-",
				);
				const cache = (
					await db.query(
						"SELECT data FROM discovery_cache WHERE id=$1 AND expires_at>now()",
						[cacheID],
					)
				).rows[0]?.data;
				if (cache) {
					cacheHits++;
					return cache;
				}
				const configuredKey =
					engine === "yandex"
						? process.env.YANDEX_SERPAPI_KEY?.trim() ||
							process.env.SERPAPI_API_KEY?.trim()
						: process.env.SERPAPI_API_KEY?.trim();
				if (!configuredKey)
					throw new DiscoveryError(
						"MISSING_API_KEY",
						engine,
						`${engine}: configure the server-side SerpAPI credential and restart the application`,
					);
				const gate = await db.query(
					"INSERT INTO discovery_limits VALUES($1,now()) ON CONFLICT(id) DO UPDATE SET requested_at=EXCLUDED.requested_at WHERE discovery_limits.requested_at<now()-interval '2 seconds' RETURNING id",
					["engine:" + engine],
				);
				if (!gate.rows.length)
					throw new DiscoveryError(
						"RATE_LIMIT",
						engine,
						`${engine}: wait 2 seconds before a new query`,
					);
				const response = await adapters[engine].search(task.query, text);
				await db.query(
					"INSERT INTO discovery_cache VALUES($1,$2::jsonb,now()+interval '15 minutes') ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data,expires_at=EXCLUDED.expires_at",
					[cacheID, JSON.stringify(response)],
				);
				return response;
			}),
		);
		const sources: SourceEvidence[] = [];
		let hasNext = false;
		settled.forEach((result, i) => {
			if (result.status === "fulfilled") {
				sources.push(...result.value.items);
				hasNext ||= result.value.hasNext;
			} else {
				const e = result.reason;
				task.errors.push({
					engine: engines[i],
					code: e instanceof DiscoveryError ? e.code : "PROVIDER_ERROR",
					message:
						e instanceof DiscoveryError
							? e.message
							: "Provider operation failed. No result was fabricated.",
				});
			}
		});
		if (task.kind === "search") {
			const contacts = sources.flatMap((source) =>
				contactsFromSources([source], source.url),
			);
			const saved = await persistDiscovery(
				db,
				sources,
				contacts,
				task.query.country,
			);
			task.results = saved.ids;
			task.counts = {
				returned: saved.ids.length,
				excluded: saved.excluded,
				merged: saved.merged,
			};
			task.result = {
				query: text,
				page: task.query.page,
				hasNext,
				added: saved.added,
				existing: saved.ids.length - saved.added,
				rawCount: sources.length,
				resources: saved.resources,
				rejected: saved.rejected,
				qualificationPolicy:
					"eyelash-business-v1; China seller evidence excluded; unknown origin is not verified foreign",
			};
		} else if (lead) {
			const contacts = contactsFromSources(
				sources,
				lead.intel?.manual.officialWebsite || lead.website,
				countryFor(lead.intel?.manual.country || "")?.code as
					| CountryCode
					| undefined,
			);
			if (task.result?.includeWebsite) {
				const collected = await collectWebsitePages(
					lead.intel?.manual.officialWebsite || lead.website,
				);
				websiteFailures.push(...collected.failures);
				websitePagesCount = collected.pages.length;
				for (const page of collected.pages)
					contacts.push(
						...contactsFromHTML(
							page.html,
							page.url,
							lead.intel?.manual.officialWebsite || lead.website,
							countryFor(lead.intel?.manual.country || "")?.code as
								| CountryCode
								| undefined,
						),
					);
			}
			await transaction(db, async (client) => {
				for (const source of sources)
					await client.query(
						"INSERT INTO discovery_sources VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET data=EXCLUDED.data",
						[
							stableID(
								lead.id +
									"|" +
									source.engine +
									"|" +
									source.query +
									"|" +
									source.url,
								"source-",
							),
							lead.id,
							JSON.stringify(source),
						],
					);
				for (const raw of contacts) {
					const contact = scopeContact(raw, lead.id);
					await client.query(
						"INSERT INTO discovery_contacts VALUES($1,$2,$3::jsonb) ON CONFLICT(id) DO UPDATE SET data=discovery_contacts.data || jsonb_build_object('lastSeenAt',$4::text)",
						[contact.id, lead.id, JSON.stringify(contact), contact.collectedAt],
					);
				}
				const best = bestPublicWhatsApp(contacts);
				const time = new Date().toISOString();
				const attemptedWhatsApp =
					["whatsapp", "contacts"].includes(task.query.intent ?? "whatsapp") ||
					!!best;
				const usableQuery =
					settled.some((s) => s.status === "fulfilled") ||
					websitePagesCount > 0;
				const updates: Record<string, string> = { lastEnrichmentAt: time };
				if (attemptedWhatsApp) {
					updates.whatsappAttemptedAt = time;
					updates.whatsappLookupStatus = !usableQuery
						? "failed"
						: task.errors.length || websiteFailures.length
							? "partial"
							: best
								? "found"
								: contacts.some(
											(c) =>
												c.kind === "whatsapp" || c.kind === "whatsapp-link",
										)
									? "candidates"
									: "empty";
					updates.whatsappLookupError = task.errors
						.map((e) => `${e.engine}: ${e.code} — ${e.message}`)
						.concat(websiteFailures)
						.join(" | ");
					if (usableQuery) updates.whatsappCheckedAt = time;
				}

				if (best && !lead.whatsapp) {
					updates.whatsapp = best.value.replace(/\D/g, "");
					updates.whatsappSource = best.sourceUrl;
				}
				await client.query(
					"UPDATE leads SET data=data || $2::jsonb WHERE id=$1",
					[lead.id, JSON.stringify(updates)],
				);
				await addHistory(client, lead.id, "contact-enrichment", {
					taskId: task.id,
					intent: task.query.intent ?? "whatsapp",
					found: contacts.length,
					failures: websiteFailures,
					engineErrors: task.errors,
					websitePagesCount,
					engines: engines,
					apiRequestsAttempted: task.usage,
				});
			});
			task.results = [lead.id];
			task.counts = { returned: contacts.length, excluded: 0, merged: 0 };
			task.result = {
				query: text,
				page: task.query.page,
				hasNext: false,
				found: !!bestPublicWhatsApp(contacts),
				websiteFailures,
				websitePagesCount,
			};
		}
		task.cacheHit = cacheHits === engines.length;
		task.state =
			task.errors.length === engines.length && websitePagesCount === 0
				? "failed"
				: task.errors.length || websiteFailures.length
					? "partial"
					: "succeeded";
	} catch {
		task.state = "failed";
		task.errors.push({
			engine: "storage",
			code: "DATABASE_ERROR",
			message:
				"Task could not complete storage or customer loading. Existing records were retained.",
		});
	}
	task.finishedAt = new Date().toISOString();
	await saveTask(db, task);
}
export async function pumpTasks() {
	if (runtime.prospectPump) return runtime.prospectPump;
	runtime.prospectPump = (async () => {
		const db = await prospectDB();
		while (true) {
			const claimed = await db.query(
				"UPDATE discovery_tasks SET data=data || jsonb_build_object('state','running','startedAt',now()::text) WHERE id=(SELECT id FROM discovery_tasks WHERE data->>'state'='queued' ORDER BY created_at LIMIT 1 FOR UPDATE SKIP LOCKED) AND data->>'state'='queued' RETURNING data",
			);
			if (!claimed.rows.length) break;
			await runTask(claimed.rows[0].data);
		}
	})()
		.catch(() => {})
		.finally(() => {
			runtime.prospectPump = undefined;
		});
	return runtime.prospectPump;
}
export async function taskResponse(id: string) {
	const db = await prospectDB();
	const task: SearchTask | undefined = (
		await db.query("SELECT data FROM discovery_tasks WHERE id=$1", [id])
	).rows[0]?.data;
	if (!task) return null;
	const results: Lead[] = task.results?.length
		? (
				await db.query("SELECT data FROM leads WHERE id=ANY($1::text[])", [
					task.results,
				])
			).rows.map((r) => r.data)
		: [];
	return {
		task,
		results: await decorateLeads(db, results),
		ids: task.results ?? [],
		count: results.length,
		added: task.result?.added ?? 0,
		existing: task.result?.existing ?? 0,
		query: task.result?.query ?? "",
		page: task.query.page,
		hasNext: !!task.result?.hasNext,
		errors: task.errors,
		found: task.result?.found ?? false,
		lead:
			results.length === 1 ? (await decorateLeads(db, results))[0] : undefined,
	};
}
export async function enqueueSearch(
	req: Request,
	kind: SearchTask["kind"] = "search",
) {
	try {
		const origin = req.headers.get("origin");
		if (origin && new URL(origin).host !== req.headers.get("host"))
			return Response.json({ code: "CROSS_ORIGIN" }, { status: 403 });
		const task = await createTask(await req.json(), kind);
		return Response.json(
			{
				taskId: task.id,
				state: "queued",
				message:
					"App-local worker; requires the application server to remain running. Each non-cached engine query may use account quota.",
			},
			{ status: 202 },
		);
	} catch (e) {
		return Response.json(
			{
				code:
					e instanceof Error && e.message === "INVALID_INPUT"
						? "INVALID_INPUT"
						: "DATABASE_ERROR",
			},
			{
				status: e instanceof Error && e.message === "INVALID_INPUT" ? 400 : 503,
			},
		);
	}
}
