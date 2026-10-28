import type { Lead } from "../leads";
export type ProspectFilters = {
	city: string;
	grade: string;
	confidence: string;
	whatsapp: string;
	instagram: string;
	telegram: string;
	website: string;
	imports: string;
	b2b: string;
};
export const emptyFilters: ProspectFilters = {
	city: "",
	grade: "",
	confidence: "",
	whatsapp: "",
	instagram: "",
	telegram: "",
	website: "",
	imports: "",
	b2b: "exclude-consumers",
};
export function filterProspects(leads: Lead[], f: ProspectFilters) {
	return leads.filter((l) => {
		if (l.mock) return true;
		const i = l.intel,
			c = i?.contacts ?? [];
		const wa = c.filter(
			(x) => x.kind === "whatsapp" || x.kind === "whatsapp-link",
		);
		const phone = c.some((x) => x.kind === "phone");
		const found = wa.length > 0 || !!l.whatsapp;
		const social = (kind: string) => c.some((x) => x.kind === kind);
		return (
			(!f.city ||
				(i?.manual.city ?? "").toLowerCase().includes(f.city.toLowerCase())) &&
			(!f.grade || i?.analysis.grade === f.grade) &&
			(!f.confidence || (i?.analysis.coverage ?? 0) >= Number(f.confidence)) &&
			(!f.whatsapp ||
				(f.whatsapp === "found"
					? found
					: f.whatsapp === "missing"
						? !found
						: f.whatsapp === "phone"
							? phone
							: wa.some((x) => x.identity === "manually-confirmed"))) &&
			(!f.instagram || (f.instagram === "yes") === social("instagram")) &&
			(!f.telegram || (f.telegram === "yes") === social("telegram")) &&
			(!f.website || (f.website === "yes") === !!i?.manual.officialWebsite) &&
			(!f.imports ||
				(f.imports === "yes") === !!i?.manual.corporateImports?.length) &&
			(f.b2b === "all" || f.b2b === "signals"
				? f.b2b === "all" || i?.analysis.b2b === "signal"
				: i?.analysis.b2b !== "consumer-excluded")
		);
	});
}
export async function awaitDiscoveryTask(
	id: string,
	onState?: (text: string) => void,
) {
	for (let n = 0; n < 225; n++) {
		const r = await fetch(
			"/api/prospecting/tasks?id=" + encodeURIComponent(id),
		);
		const d = await r.json();
		if (!r.ok) throw new Error(d.code ?? "DATABASE_ERROR");
		onState?.(`${d.task.state} · API requests attempted: ${d.task.usage}`);
		if (!["queued", "running"].includes(d.task.state)) return d;
		await new Promise((resolve) => setTimeout(resolve, 800));
	}
	throw new Error(
		"Task is still running; open Search tasks to inspect it. Do not repeat a paid query blindly.",
	);
}
export function whatsappIntroduction(language: string, name: string) {
	const team = name.slice(0, 100);
	const texts: Record<string, string> = {
		ru: `Здравствуйте, команда ${team}! Мы — BAIHUA SHIJIE EYELASH, производитель ресниц из Циндао, Китай. Предлагаем оптовые поставки и OEM/ODM. Можно отправить вам каталог и варианты образцов? MOQ, цены и сроки уточним по вашим требованиям. Если предложение неактуально, сообщите — мы прекратим переписку.`,
		pl: `Dzień dobry, zespole ${team}! Jesteśmy BAIHUA SHIJIE EYELASH, producentem rzęs z Qingdao w Chinach. Oferujemy współpracę hurtową i OEM/ODM. Czy możemy przesłać katalog i informacje o próbkach? MOQ, ceny i terminy ustalimy według specyfikacji. Jeśli oferta nie jest odpowiednia, prosimy o informację — nie będziemy kontynuować kontaktu.`,
		tr: `Merhaba ${team} ekibi! Biz Çin'in Qingdao şehrindeki kirpik üreticisi BAIHUA SHIJIE EYELASH'ız. Toptan ve OEM/ODM iş birliği sunuyoruz. Katalog ve numune seçeneklerini göndermemiz uygun olur mu? MOQ, fiyat ve teslim süresi ürün özelliklerine göre belirlenir. İlgilenmiyorsanız lütfen bildirin; tekrar iletişime geçmeyelim.`,
		en: `Hello ${team} team, we are BAIHUA SHIJIE EYELASH, an eyelash manufacturer in Qingdao, China offering wholesale and OEM/ODM. May we send a catalogue and sample options? MOQ, pricing and lead time depend on your specifications. If this is not relevant, please let us know and we will stop following up.`,
	};
	return texts[language] ?? texts.en;
}
