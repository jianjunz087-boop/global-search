import iso from "i18n-iso-countries";
import en from "i18n-iso-countries/langs/en.json";
import zh from "i18n-iso-countries/langs/zh.json";
iso.registerLocale(en);
iso.registerLocale(zh);
const names: Record<string, string> = {
	US: "United States",
	GB: "United Kingdom",
	RU: "Russia",
};
export const countries = Object.keys(iso.getAlpha2Codes())
	.map((code) => ({
		code,
		name: names[code] || iso.getName(code, "en") || code,
		zh: iso.getName(code, "zh") || iso.getName(code, "en") || code,
	}))
	.sort((a, b) => a.name.localeCompare(b.name, "en"));
export function countryFor(value: string) {
	const aliases: Record<string, string> = {
		turkey: "TR",
		türkiye: "TR",
		"south korea": "KR",
		"korea, republic of": "KR",
		kyrgyzstan: "KG",
		moldova: "MD",
		vietnam: "VN",
	};
	value = aliases[value.toLowerCase()] || value;
	return countries.find(
		(c) =>
			c.code === value.toUpperCase() ||
			c.name.toLowerCase() === value.toLowerCase() ||
			c.zh === value,
	);
}
export function countryLabel(value: string, chinese = false) {
	const c = countryFor(value);
	return c ? (chinese ? c.zh : c.name) : value;
}
export function flagFor(value: string) {
	const c = countryFor(value);
	return c
		? Array.from(c.code)
				.map((x) => String.fromCodePoint(127397 + x.charCodeAt(0)))
				.join("")
		: "";
}
