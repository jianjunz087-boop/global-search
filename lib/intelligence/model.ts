export const factors = [
	"Demand trend",
	"Buyer reachability",
	"Competitive headroom",
	"Product fit",
	"Logistics/payment safety",
	"Compliance safety",
];
export const weights = [25, 20, 15, 20, 10, 10];
export const products = [
	"DIY Cluster Lashes",
	"YY Lashes",
	"Dense/Volume Lashes",
	"Strip Lashes",
	"Premade Fans",
	"Self-adhesive Lashes",
	"2-in-1 Kits",
	"6-in-1 Kits",
	"640-fans Kits",
	"Lash Glue",
	"Bond & Seal",
	"Remover",
	"Tweezers",
	"Brushes",
	"OEM Packaging",
];
export type Market = {
	id: string;
	name: string;
	language: string;
	values: (number | null)[];
	note: string;
	kind: "demo" | "manual";
	updatedAt: string;
};
export type Buyer = {
	id: string;
	name: string;
	country: string;
	website: string;
	type: string;
	email: string;
	phone: string;
	social: string;
	products: string;
	brand: string;
	source: string;
	potential: string;
	status: string;
	lastContact: string;
	nextFollowUp: string;
	note: string;
	collectedAt: string;
};
export function score(values: (number | null)[], w = weights) {
	let total = 0,
		coverage = 0;
	values.forEach((v, i) => {
		if (v !== null) {
			total += v * w[i];
			coverage += w[i];
		}
	});
	return {
		score: coverage ? Math.round(total / coverage) : null,
		coverage: Math.round((coverage / w.reduce((a, b) => a + b, 0)) * 100),
	};
}
export const initialMarkets: Market[] = [
	["Russia", "Russian"],
	["Kazakhstan", "Kazakh / Russian"],
	["Uzbekistan", "Uzbek"],
	["Kyrgyzstan", "Kyrgyz / Russian"],
	["Poland", "Polish"],
	["Turkey", "Turkish"],
	["United States", "English"],
	["United Kingdom", "English"],
	["Germany", "German"],
	["France", "French"],
	["Italy", "Italian"],
	["Spain", "Spanish"],
	["Saudi Arabia", "Arabic"],
	["United Arab Emirates", "Arabic / English"],
	["Japan", "Japanese"],
	["South Korea", "Korean"],
	["Australia", "English"],
].map(([name, language], i) => ({
	id: name.toLowerCase().replaceAll(" ", "-"),
	name,
	language,
	values: [55 + (i % 5) * 7, 50 + (i % 4) * 10, 40 + (i % 6) * 6, 70, 50, 55],
	note: "Synthetic scoring scenario only. Import demand, prices, channels, trade barriers and payment/logistics conditions require dated, country-specific evidence. No measured sales or import values.",
	kind: "demo",
	updatedAt: "2026-10-27",
}));
export function parseCSV(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [],
		value = "",
		quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (c === '"') {
			if (quoted && text[i + 1] === '"') {
				value += '"';
				i++;
			} else quoted = !quoted;
		} else if (c === "," && !quoted) {
			row.push(value);
			value = "";
		} else if ((c === "\n" || c === "\r") && !quoted) {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(value);
			if (row.some(Boolean)) rows.push(row);
			row = [];
			value = "";
		} else value += c;
	}
	if (quoted) throw new Error("Unclosed CSV quote");
	row.push(value);
	if (row.some(Boolean)) rows.push(row);
	return rows;
}
export function csv(rows: readonly (readonly unknown[])[]) {
	return (
		"\uFEFF" +
		rows
			.map((r) =>
				r
					.map((v) => {
						let s = String(v ?? "");
						if (/^[=+@\-\t\r]/.test(s)) s = "'" + s;
						return '"' + s.replaceAll('"', '""') + '"';
					})
					.join(","),
			)
			.join("\r\n")
	);
}
export function domain(url: string) {
	const u = new URL(url);
	if (!["http:", "https:"].includes(u.protocol))
		throw new Error("Website must use HTTP(S)");
	return u.hostname.toLowerCase().replace(/^www\./, "");
}
