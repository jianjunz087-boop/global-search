import { liveCountries, tradeWarning } from "../intelligence/live-model";
import { parseTrade, CollectionError } from "../intelligence/live";
import { stableID } from "./identity";
export const candidateHS = (product: string) =>
	/glue|bond|seal|remover|tweezer|brush|kit/i.test(product)
		? {
				codes: [],
				state: "Pending customs classification",
				reason:
					"Adhesives, removers, tools and mixed kits must be classified separately; do not apply a hair-article HS code.",
			}
		: {
				codes: ["670419", "670420", "670490"],
				state:
					"Pending verification by material, product specification and destination customs",
				reason:
					"Candidates cover broad synthetic/human/other hair articles, not eyelash-only or DIY-cluster-specific categories. Official returned description controls scope.",
			};
export function annualChanges(records: any[]) {
	const sorted = [...records].sort((a, b) => a.year - b.year);
	return sorted.map((r) => {
		const previous = sorted.find(
			(p) =>
				p.year === r.year - 1 &&
				p.hsCode === r.hsCode &&
				p.country === r.country,
		);
		const comparable =
			previous &&
			previous.year === r.year - 1 &&
			previous.hsCode === r.hsCode &&
			previous.classification === r.classification &&
			r.classification !== "Unknown revision" &&
			previous.value > 0;
		return {
			...r,
			yoy: comparable
				? Math.round((r.value / previous.value - 1) * 10000) / 100
				: null,
			yoyNote: comparable
				? "Same reported HS revision and adjacent years; broad category only"
				: "Unknown: missing adjacent year, zero base, or changed/unknown HS revision",
		};
	});
}
export async function collectTradeWindow(
	input: {
		country: string;
		hsCode: string;
		years: number[];
		scope: "annual" | "partners";
	},
	fetcher: typeof fetch = fetch,
) {
	const c = liveCountries.find((c) => c.name === input.country);
	if (
		!c ||
		!["670419", "670420", "670490"].includes(input.hsCode) ||
		!Array.isArray(input.years) ||
		input.years.length < 1 ||
		input.years.length > 5 ||
		new Set(input.years).size !== input.years.length ||
		input.years.some(
			(y) =>
				!Number.isInteger(y) || y < 2015 || y >= new Date().getUTCFullYear(),
		) ||
		!["annual", "partners"].includes(input.scope) ||
		(input.scope === "partners" && input.years.length !== 1)
	)
		throw new CollectionError(
			"INVALID_QUERY",
			400,
			"Choose country, broad HS scope and 1–5 completed years (one year for partners)",
		);
	const u = new URL("https://comtradeapi.un.org/public/v1/preview/C/A/HS");
	const params: Record<string, string> = {
		period: [...input.years].sort().join(","),
		reporterCode: c.reporter,
		cmdCode: input.hsCode,
		flowCode: "M",
		partner2Code: "0",
		customsCode: "C00",
		motCode: "0",
		maxRecords: "500",
		aggregateBy: "6",
		breakdownMode: "classic",
		includeDesc: "true",
	};
	if (input.scope === "annual") params.partnerCode = "0";
	for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v);
	let response: Response;
	try {
		response = await fetcher(u, {
			cache: "no-store",
			signal: AbortSignal.timeout(30000),
		});
	} catch {
		throw new CollectionError(
			"NETWORK_ERROR",
			502,
			"Official trade service unreachable or timed out. No import values fabricated.",
		);
	}
	if (!response.ok)
		throw new CollectionError(
			response.status === 429 ? "QUOTA_EXCEEDED" : "PROVIDER_ERROR",
			502,
			`UN Comtrade HTTP ${response.status}`,
		);
	let data: any;
	try {
		data = await response.json();
	} catch {
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Official response is not JSON",
		);
	}
	if (!Array.isArray(data.data))
		throw new CollectionError(
			"INVALID_RESPONSE",
			502,
			"Official response has no data array",
		);
	const collectedAt = new Date().toISOString();
	if (input.scope === "annual") {
		const records = input.years.flatMap((year) => {
			const parsed = parseTrade(
				{
					data: data.data.filter((r: any) => String(r.period) === String(year)),
				},
				{
					source: "comtrade",
					country: c.name,
					product: "Broad hair-article trade context",
					year,
					hsCode: input.hsCode,
				},
				collectedAt,
				u.href,
			);
			return parsed.trades.map((t) => {
				const raw = data.data.find(
					(r: any) =>
						String(r.period) === String(year) && String(r.partnerCode) === "0",
				);
				return {
					...t,
					quantity:
						typeof raw?.qty === "number" &&
						Number.isFinite(raw.qty) &&
						raw.qty >= 0
							? raw.qty
							: null,
					quantityUnit:
						typeof raw?.qtyUnitAbbr === "string" ? raw.qtyUnitAbbr : "Unknown",
					quantityEstimated:
						typeof raw?.isQtyEstimated === "boolean"
							? raw.isQtyEstimated
							: null,
					netWeightKg:
						typeof raw?.netWgt === "number" &&
						Number.isFinite(raw.netWgt) &&
						raw.netWgt >= 0
							? raw.netWgt
							: null,
				};
			});
		});
		return {
			records: annualChanges(records),
			partners: [],
			missingYears: input.years.filter(
				(y) => !records.some((r) => r.year === y),
			),
			collectedAt,
			sourceUrl: u.href,
			coverage:
				"Public preview ≤500 rows; absence is unknown; no eyelash-specific market size estimate",
			limitations: tradeWarning,
		};
	}
	const seen = new Set<string>();
	const partners = data.data
		.flatMap((r: any) => {
			const code = String(r.partnerCode);
			if (
				String(r.reporterCode) !== c.reporter ||
				String(r.period) !== String(input.years[0]) ||
				r.flowCode !== "M" ||
				String(r.cmdCode) !== input.hsCode ||
				String(r.partner2Code) !== "0" ||
				r.customsCode !== "C00" ||
				String(r.motCode) !== "0" ||
				!/^\d+$/.test(code) ||
				Number(code) <= 0 ||
				Number(code) >= 900 ||
				typeof r.partnerDesc !== "string" ||
				typeof r.primaryValue !== "number" ||
				!Number.isFinite(r.primaryValue) ||
				r.primaryValue < 0 ||
				seen.has(code)
			)
				return [];
			seen.add(code);
			return [
				{
					id: stableID(
						input.country + input.hsCode + input.years[0] + code,
						"trade-partner-",
					),
					country: input.country,
					year: input.years[0],
					partnerCode: code,
					partner: r.partnerDesc,
					hsCode: input.hsCode,
					description: r.cmdDesc ?? "Unknown",
					classification: r.classificationCode ?? "Unknown revision",
					value: r.primaryValue,
					unit: "USD",
					sourceUrl: u.href,
					collectedAt,
					limitations:
						"Returned partner sample, may include separately reported territories; preview coverage is not guaranteed. Not company imports or an eyelash-only supplier ranking.",
				},
			];
		})
		.sort((a: any, b: any) => b.value - a.value);
	return {
		records: [],
		partners,
		missingYears: [],
		collectedAt,
		sourceUrl: u.href,
		coverage:
			"Returned public partner sample; not a complete ranking or national coverage claim",
		limitations: tradeWarning,
	};
}
