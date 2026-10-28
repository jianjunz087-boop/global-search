import type { Lead } from "../leads";
import { csv } from "../intelligence/model";
export const exportHeaders = [
	"id",
	"Company / 公司",
	"Verified country",
	"Search target country",
	"City",
	"Customer type",
	"Website",
	"Source",
	"WhatsApp",
	"WhatsApp state",
	"Phones (WhatsApp unconfirmed)",
	"Email",
	"Instagram",
	"Telegram",
	"Facebook",
	"Contact evidence JSON",
	"Rating",
	"Score",
	"Evidence coverage",
	"Score components JSON",
	"Facts JSON",
	"Inferences JSON",
	"Company import records JSON",
	"Company import status",
	"Sources JSON",
	"Search history JSON",
	"CRM status",
	"Notes",
	"Next follow-up",
	"Data type",
];
export function exportRows(leads: Lead[]) {
	return leads.map((l) => {
		const intel = l.intel,
			a = intel?.analysis,
			c = intel?.contacts ?? [];
		const values = (kind: string) =>
			c
				.filter((x) => x.kind === kind)
				.map((x) => x.value)
				.join("; ");
		return [
			l.id,
			intel?.manual.companyName || l.name,
			l.mock ? l.country : intel?.manual.country || "Unknown",
			l.targetCountry ||
				intel?.targetCountry ||
				(!l.mock && l.country !== "Not verified" ? l.country : ""),
			intel?.manual.city || "Unknown",
			l.type,
			intel?.manual.officialWebsite || l.website,
			l.source,
			values("whatsapp") || l.whatsapp,
			c
				.filter((x) => x.kind === "whatsapp" || x.kind === "whatsapp-link")
				.map(
					(x) =>
						`${x.value}: found; format ${x.format}; identity ${x.identity}; availability ${x.availability}; ${x.sourceUrl}`,
				)
				.join("; ") || "Not found / 未找到",
			values("phone"),
			values("email") || l.email,
			values("instagram"),
			values("telegram"),
			values("facebook"),
			JSON.stringify(c),
			l.mock ? "DEMO" : (a?.grade ?? "Unassessed"),
			l.mock ? l.score : (a?.score ?? ""),
			a?.coverage ?? 0,
			JSON.stringify(a?.components ?? []),
			JSON.stringify(a?.facts ?? []),
			JSON.stringify(a?.inferences ?? []),
			JSON.stringify(intel?.manual.corporateImports ?? []),
			a?.importStatus ?? "暂无企业级进口数据",
			JSON.stringify(intel?.sources ?? [{ url: l.source }]),
			JSON.stringify(intel?.history ?? []),
			l.status,
			l.note,
			l.nextFollowUp,
			l.mock
				? "DEMO — FICTIONAL"
				: "PUBLIC / OPERATOR-SUPPLIED EVIDENCE — REVIEW REQUIRED",
		];
	});
}
export function prospectsCSV(leads: Lead[]) {
	return csv([exportHeaders, ...exportRows(leads)]);
}
export function safeCell(value: unknown) {
	const s = String(value ?? "");
	return /^[=+@\-\t\r]/.test(s) ? "'" + s : s;
}
