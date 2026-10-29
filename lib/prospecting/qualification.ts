import { safeURL, researchResource } from "./identity";

/** Evidence rules use returned pages only, never query text or target country. */
export function qualifyBusiness(source: {
	url: string;
	title: string;
	snippet: string;
}) {
	const url = safeURL(source.url);
	const text = `${source.title} ${source.snippet}`;
	const reasons: string[] = [];
	const host = url?.hostname.toLowerCase().replace(/^www\./, "") ?? "";
	if (!url) reasons.push("invalid-url");
	if (
		/(?:^|\.)(?:alibaba\.com|aliexpress\.com|made-in-china\.com|1688\.com|globalsources\.com)$/.test(
			host,
		)
	)
		reasons.push("supplier-marketplace");
	if (
		/\.cn$/.test(host) ||
		/\b(?:based|located|headquartered)\s+in\s+(?:china|qingdao|shenzhen|guangzhou|pingdu)\b|\b(?:china|chinese)\s+(?:eyelash\s+|lash\s+)?(?:manufacturer|factory|supplier|exporter)\b|\b(?:eyelash|lash)\s+(?:manufacturer|factory|supplier|exporter)\s+(?:in|from)\s+china\b|(?:中国|青岛|平度|深圳|广州).{0,12}(?:厂家|工厂|制造商|供应商)|\b(?:whatsapp|phone|tel(?:ephone)?)\s*[:：]?\s*\+86\b/i.test(
			text,
		)
	)
		reasons.push("china-seller-evidence");
	const relevant =
		/\b(?:eyelash(?:es)?|eye[ -]lashes|lashes|lash(?:es)?[ -](?:extensions?|suppl(?:y|ies|ier|iers)|wholesale|store|shop)|cluster[ -]lashes|faux[ -]cils|ciglia|pestañas|wimpern|kirpik\w*)\b|ресниц|rzęs|rzes|假睫毛/i.test(
			`${text} ${host} ${url?.pathname ?? ""}`,
		);
	if (!relevant) reasons.push("no-eyelash-business-evidence");
	if (
		/\b(?:tutorial|how to|news|jobs?|careers?|course|training)\b|教程|招聘/i.test(
			source.title,
		) &&
		!/\b(?:wholesale|distributor|shop|store|supplies|supplier)\b/i.test(
			source.title,
		)
	)
		reasons.push("content-not-business");
	if (researchResource(source.url, source.title))
		reasons.push("research-resource");
	return {
		accepted: reasons.length === 0,
		reasons,
		countryStatus: "unverified" as const,
	};
}
export const discoveryExclusions =
	"-site:cn -site:alibaba.com -site:aliexpress.com -site:made-in-china.com -site:1688.com -site:globalsources.com";
