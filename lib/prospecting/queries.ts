import { countryFor } from "../countries";
import { normalizeKeyword } from "../keywords";
import type { DiscoveryQuery } from "./types";
const languageFor: Record<string, string> = {
	RU: "ru",
	KZ: "ru",
	UZ: "ru",
	KG: "ru",
	PL: "pl",
	TR: "tr",
};
export function suggestedLanguage(country: string) {
	return languageFor[countryFor(country)?.code ?? ""] ?? "en";
}
const business: Record<string, string> = {
	en: '(wholesale OR wholesaler OR importer OR distributor OR "private label")',
	ru: '(оптом OR поставщик OR импортёр OR дистрибьютор OR "собственный бренд")',
	pl: "(hurtownia OR hurt OR importer OR dystrybutor OR marka)",
	tr: '(toptan OR ithalatçı OR distribütör OR "özel marka")',
};
const product: Record<string, string> = {
	en: "eyelashes",
	ru: "ресницы",
	pl: "rzęsy",
	tr: "kirpik",
};
export function validateDiscovery(body: any): DiscoveryQuery {
	const {
		keyword = "",
		country = "",
		type = "",
		product: category = "",
		engine = "google",
		language = "auto",
		region = "",
		limit = 10,
		timeoutMs = 30000,
		page = 1,
		platform = "web",
		intent,
		companyId,
	} = body ?? {};
	if (
		typeof keyword !== "string" ||
		keyword.length > 200 ||
		typeof country !== "string" ||
		(country && !countryFor(country)) ||
		!["google", "yandex", "both"].includes(engine) ||
		!["auto", "en", "ru", "pl", "tr", "de", "fr", "es"].includes(language) ||
		typeof region !== "string" ||
		!/^[0-9]{0,10}$/.test(region) ||
		!Number.isInteger(limit) ||
		limit < 1 ||
		limit > 20 ||
		!Number.isInteger(timeoutMs) ||
		timeoutMs < 5000 ||
		timeoutMs > 45000 ||
		!Number.isInteger(page) ||
		page < 1 ||
		page > 100 ||
		!["web", "instagram", "telegram", "facebook", "directories"].includes(
			platform,
		) ||
		typeof type !== "string" ||
		type.length > 100 ||
		typeof category !== "string" ||
		category.length > 100 ||
		(intent &&
			!["whatsapp", "website", "instagram", "telegram", "contacts"].includes(
				intent,
			)) ||
		(companyId !== undefined &&
			(typeof companyId !== "string" || companyId.length > 100))
	)
		throw new Error("INVALID_INPUT");
	return {
		keyword: keyword.trim(),
		country: countryFor(country)?.name ?? "",
		type,
		product: category,
		engine,
		language: language === "auto" ? suggestedLanguage(country) : language,
		region,
		limit,
		timeoutMs,
		page,
		platform,
		intent,
		companyId,
	};
}
export function discoveryText(
	q: DiscoveryQuery,
	company?: { name: string; website: string },
) {
	if (company) {
		const safeName = company.name.replace(/["\n\r]/g, " ").slice(0, 120);
		let host = "";
		try {
			host = new URL(company.website).hostname.replace(/^www\./, "");
		} catch {}
		if (q.intent === "whatsapp")
			return `site:${host}${
				/instagram\.com|facebook\.com|t\.me/.test(host)
					? new URL(company.website).pathname
							.split("/")
							.filter(Boolean)
							.slice(0, 1)
							.map((p) => "/" + p)
							.join("")
					: ""
			} ("WhatsApp" OR "wa.me" OR "api.whatsapp.com")`;
		const scope =
			q.intent === "instagram"
				? "site:instagram.com"
				: q.intent === "telegram"
					? "(site:t.me OR site:telegram.me)"
					: q.intent === "website"
						? "(official website OR контакты OR contact)"
						: "(WhatsApp OR contact OR contacts OR контакты OR Instagram OR Telegram)";
		return `"${safeName}" ${scope} ${q.country}`;
	}
	const term =
		normalizeKeyword(q.keyword) || product[q.language] || "eyelashes";
	const category = q.product && q.product !== q.keyword ? q.product : "";
	const scope =
		q.platform === "instagram"
			? "site:instagram.com"
			: q.platform === "telegram"
				? "(site:t.me OR site:telegram.me)"
				: q.platform === "facebook"
					? "site:facebook.com"
					: q.platform === "directories"
						? "(directory OR exhibitor OR exhibition OR importer directory OR каталог)"
						: "";
	const targets = q.type
		? `(${q.type} OR ${business[q.language] ?? business.en})`
		: (business[q.language] ?? business.en);
	return [term, category, targets, q.country, scope].filter(Boolean).join(" ");
}
export function suggestedQueries(country: string) {
	const lang = suggestedLanguage(country);
	const sets: Record<string, string[]> = {
		en: [
			"eyelash wholesaler WhatsApp",
			"eyelash importer contact",
			"DIY cluster lashes distributor",
			"private label eyelash brand",
			"eyelash wholesale Telegram",
		],
		ru: [
			"ресницы оптом WhatsApp",
			"поставщик ресниц оптом контакты",
			"импортёр накладных ресниц",
			"наборы ресниц оптом",
			"ресницы оптом Telegram",
		],
		pl: [
			"rzęsy hurtownia WhatsApp",
			"importer rzęs kontakt",
			"hurtownia rzęs kontakt",
			"rzęsy do kępek hurt",
			"marka rzęs producent kontakt",
		],
		tr: [
			"toptan kirpik WhatsApp",
			"kirpik ithalatçı iletişim",
			"kirpik distribütör",
			"özel marka kirpik",
			"toptan kirpik Telegram",
		],
	};
	return sets[lang] ?? sets.en;
}
