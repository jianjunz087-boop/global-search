import type { Lead } from "../leads";
import { suggestedLanguage } from "./queries";
import { bestPublicWhatsApp } from "./contacts";
import {
	defaultWeights,
	type Claim,
	type ContactEvidence,
	type LeadAnalysis,
	type ManualProfile,
	type ScoreWeights,
	type SourceEvidence,
} from "./types";
const targetProduct = /lash|ресниц|rzęs|rzęsy|kirpik/i;
const businessPattern =
	/wholesal|importer|distribut|private.label|OEM|ODM|опт|поставщик|импорт[её]р|дистриб|hurtown|dystrybut|toptan|ithalat|distribüt/i;
const oemPattern =
	/private.label|own.brand|OEM|ODM|собственн.{0,10}бренд|marka.własna|özel.marka/i;
export function b2bDisposition(
	sources: SourceEvidence[],
	manual: ManualProfile = {},
) {
	const text = sources
		.filter((s) => s.engine !== "manual")
		.map((s) => s.title + " " + s.snippet)
		.join(" ");
	if (manual.excludedConsumer) return "consumer-excluded" as const;
	if (
		businessPattern.test(text) ||
		manual.claims?.some((c) => c.key === "business" && c.state === "fact")
	)
		return "signal" as const;
	if (
		/personal.blog|my.daily|my.makeup.routine|личный.блог|личная.страница|makijaż.dzienny/i.test(
			text,
		)
	)
		return "consumer-excluded" as const;
	return "unqualified" as const;
}
export function analyzeLead(
	lead: Lead,
	sources: SourceEvidence[],
	contacts: ContactEvidence[],
	manual: ManualProfile = {},
	weights: ScoreWeights = defaultWeights,
): LeadAnalysis {
	const text = sources
			.filter((s) => s.engine !== "manual")
			.map((s) => s.title + " " + s.snippet)
			.join(" "),
		inferences: Claim[] = [],
		facts = (manual.claims ?? []).filter((c) => c.state === "fact");
	const infer = (key: Claim["key"], statement: string) => {
		const source = sources.find((s) =>
			(
				({
					product: targetProduct,
					business: businessPattern,
					oem: oemPattern,
				}) as Record<string, RegExp>
			)[key]?.test(s.title + " " + s.snippet),
		);
		if (source)
			inferences.push({
				key,
				statement,
				state: "inference",
				sourceUrl: source.url,
				collectedAt: source.collectedAt,
				quote: source.snippet.slice(0, 1000),
			});
	};
	if (targetProduct.test(text))
		infer(
			"product",
			"Indexed source mentions eyelash-related products; actual product range and cluster/kit specifications require verification.",
		);
	if (businessPattern.test(text))
		infer(
			"business",
			"Indexed source claims wholesale/import/distribution activity; not verified company status or purchasing capacity.",
		);
	if (oemPattern.test(text))
		infer(
			"oem",
			"Private-label/brand wording suggests OEM/ODM relevance; ownership and demand remain unverified.",
		);
	const wa = bestPublicWhatsApp(contacts),
		whatsappWeight =
			wa?.identity === "manually-confirmed"
				? 1
				: wa?.format === "valid"
					? 0.8
					: contacts.some(
								(c) =>
									c.kind === "whatsapp-link" &&
									c.association !== "related-unverified",
							)
						? 0.6
						: 0;
	const hasImports = (manual.corporateImports ?? []).length > 0;
	const components = (Object.keys(weights) as (keyof ScoreWeights)[]).map(
		(key) => {
			const confirmed = facts.find((f) => f.key === key),
				inferred = inferences.find((c) => c.key === key);
			let ratio = confirmed ? 1 : inferred ? 0.6 : 0;
			let basis =
				confirmed?.statement ??
				inferred?.statement ??
				"No source-backed evidence. Missing information receives no points.";
			let state: Claim["state"] = confirmed
				? "fact"
				: inferred
					? "inference"
					: "unknown";
			if (key === "whatsapp") {
				ratio = whatsappWeight;
				basis =
					ratio === 1
						? "Human confirmed public number ownership; WhatsApp account availability remains unchecked"
						: ratio
							? "Public WhatsApp evidence with valid format; company ownership/account availability still require verification"
							: "No reliably associated public WhatsApp evidence";
				state = ratio === 1 ? "fact" : ratio ? "inference" : "unknown";
			}
			if (key === "imports") {
				ratio = hasImports ? 1 : 0;
				basis = hasImports
					? "Operator-reviewed company-linked trade documents attached; not independently authenticated by this app"
					: "No company-level import records. National HS totals never earn company import points.";
				state = hasImports ? "fact" : "unknown";
			}
			return {
				key,
				weight: weights[key],
				earned: Math.round(weights[key] * ratio * 10) / 10,
				basis,
				state,
			};
		},
	);
	const score = Math.round(components.reduce((n, c) => n + c.earned, 0));
	const coverage = Math.round(
		components
			.filter((c) => c.state !== "unknown")
			.reduce((n, c) => n + c.weight, 0),
	);
	const hasPhone = contacts.some((c) => c.kind === "phone"),
		hasSocial = contacts.some((c) =>
			["instagram", "telegram", "facebook", "email"].includes(c.kind),
		);
	const completeness = wa ? 90 : hasPhone ? 55 : hasSocial ? 30 : 0;
	return {
		score,
		grade: score >= 80 ? "A" : score >= 60 ? "B" : score >= 40 ? "C" : "D",
		coverage,
		components,
		facts,
		inferences,
		unknowns: [
			"Actual company location/city unless manually verified",
			"Company size / employees / revenue unless source-backed",
			"Purchasing quantities, budget and future orders",
			"WhatsApp account registration and deliverability",
			...(hasImports
				? []
				: ["Company-specific import amount and volume unavailable"]),
		],
		b2b: b2bDisposition(sources, manual),
		contactPriority: wa
			? "high"
			: hasPhone
				? "medium"
				: hasSocial
					? "low"
					: "missing",
		contactCompleteness: completeness,
		recommendedLanguage: suggestedLanguage(
			manual.country ||
				lead.targetCountry ||
				sources[0]?.targetCountry ||
				lead.country,
		),
		recommendedReason: score
			? `Evidence-based triage only: ${score}/100; evidence coverage ${coverage}%. Verify B2B role, contacts and MOQ before outreach.`
			: "Insufficient evidence; collect public business sources before outreach.",
		companySize:
			facts.find((c) => c.key === "activity")?.statement ?? "Unknown",
		purchaseNeeds:
			"Unconfirmed. Ask the company about product specifications, quantity, OEM packaging and destination.",
		importStatus: hasImports
			? "Operator-reviewed company-linked records attached"
			: "暂无企业级进口数据 / No company-level import records",
	};
}
export function validateWeights(value: unknown): ScoreWeights {
	const w = value as ScoreWeights;
	if (
		!w ||
		typeof w !== "object" ||
		Object.keys(defaultWeights).some(
			(k) =>
				typeof w[k as keyof ScoreWeights] !== "number" ||
				!Number.isFinite(w[k as keyof ScoreWeights]) ||
				w[k as keyof ScoreWeights] < 0,
		) ||
		Object.keys(defaultWeights).reduce(
			(n, k) => n + w[k as keyof ScoreWeights],
			0,
		) !== 100
	)
		throw new Error("Six nonnegative scoring weights must sum to 100");
	return Object.fromEntries(
		Object.keys(defaultWeights).map((k) => [k, w[k as keyof ScoreWeights]]),
	) as ScoreWeights;
}
