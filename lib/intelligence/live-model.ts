export const liveCountries = [
	["Russia", "RU", "643"],
	["Kazakhstan", "KZ", "398"],
	["Uzbekistan", "UZ", "860"],
	["Kyrgyzstan", "KG", "417"],
	["Poland", "PL", "616"],
	["Turkey", "TR", "792"],
	["United States", "US", "842"],
	["United Kingdom", "GB", "826"],
	["Germany", "DE", "276"],
	["France", "FR", "251"],
	["Italy", "IT", "380"],
	["Spain", "ES", "724"],
	["Saudi Arabia", "SA", "682"],
	["United Arab Emirates", "AE", "784"],
	["Japan", "JP", "392"],
	["South Korea", "KR", "410"],
	["Australia", "AU", "36"],
].map(([name, geo, reporter]) => ({ name, geo, reporter }));
export type LiveQuery = {
	source: "google-trends" | "comtrade";
	country: string;
	product: string;
	keyword?: string;
	range?: string;
	year?: number;
	hsCode?: string;
};
export type SourceState = {
	id: string;
	name: string;
	configured: boolean;
	credentialRequired: boolean;
	status: string;
	lastAttemptAt: string | null;
	lastSuccessAt: string | null;
	lastCollected: string | null;
	lastError: string | null;
	method: string;
	url: string;
	restriction: string;
	range: string;
};
export type TradeContext = {
	id: string;
	country: string;
	year: number;
	hsCode: string;
	classification: string;
	description: string;
	value: number;
	unit: "USD";
	sourceUrl: string;
	collectedAt: string;
	method: string;
	limitations: string;
	classificationKind: "official";
	isReported: boolean | null;
};
export const tradeWarning =
	"Broad HS hair-article category, NOT eyelash-only imports or sales. Includes other hair articles; do not sum overlapping classifications, compare as eyelash market size, or feed directly into opportunity scores. Preview is limited to 500 records; missing rows are unknown, not zero.";
export const trendsWarning =
	"Google Trends normalized search interest (0–100), NOT sales or absolute searches. Separate queries/countries/time ranges are independently normalized and cannot establish country demand rankings. Low-volume, missing and partial periods require caution.";
