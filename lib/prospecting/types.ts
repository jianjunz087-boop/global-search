export type Engine = "google" | "yandex";
export type Platform =
	| "web"
	| "instagram"
	| "telegram"
	| "facebook"
	| "directories";
export type DiscoveryQuery = {
	keyword: string;
	country: string;
	type: string;
	product: string;
	engine: Engine | "both";
	language: string;
	region: string;
	limit: number;
	timeoutMs: number;
	page: number;
	platform: Platform;
	intent?: "whatsapp" | "website" | "instagram" | "telegram" | "contacts";
	companyId?: string;
};
export type SourceEvidence = {
	resourceOnly?: boolean;
	originalUrl?: string;
	engine: Engine | "manual";
	query: string;
	url: string;
	title: string;
	snippet: string;
	collectedAt: string;
	platform: Platform;
	targetCountry: string;
};
export type ContactKind =
	| "whatsapp"
	| "whatsapp-link"
	| "phone"
	| "email"
	| "instagram"
	| "telegram"
	| "facebook"
	| "website";
export type ContactEvidence = {
	id: string;
	kind: ContactKind;
	value: string;
	raw: string;
	sourceUrl: string;
	collectedAt: string;
	method: string;
	association: "same-website" | "same-account" | "related-unverified";
	format: "valid" | "unresolved";
	identity: "unverified" | "manually-confirmed";
	availability: "not-checked";
	reviewer?: string;
	reviewedAt?: string;
	reviewNote?: string;
	directUrl?: string;
	engine?: Engine;
	sources?: { url: string; method: string; collectedAt: string }[];
	evidenceIDs?: string[];
	query?: string;
};
export type AnalysisKey =
	| "product"
	| "business"
	| "whatsapp"
	| "oem"
	| "activity"
	| "imports";
export type Claim = {
	key: AnalysisKey;
	statement: string;
	state: "fact" | "inference" | "unknown";
	sourceUrl: string;
	collectedAt: string;
	reviewer?: string;
	quote?: string;
};
export type CorporateImport = {
	id: string;
	companyIdentifier: string;
	sourceUrl: string;
	provider: string;
	period: string;
	hsCode: string;
	description: string;
	amount: number | null;
	currency: string;
	quantity: number | null;
	unit: string;
	reviewer: string;
	verifiedAt: string;
	scope: string;
};
export type ManualProfile = {
	country?: string;
	city?: string;
	companyName?: string;
	officialWebsite?: string;
	claims?: Claim[];
	corporateImports?: CorporateImport[];
	excludedConsumer?: boolean;
};
export type ScoreWeights = Record<AnalysisKey, number>;
export type LeadAnalysis = {
	score: number;
	grade: "A" | "B" | "C" | "D";
	coverage: number;
	components: {
		key: AnalysisKey;
		weight: number;
		earned: number;
		basis: string;
		state: "fact" | "inference" | "unknown";
	}[];
	facts: Claim[];
	inferences: Claim[];
	unknowns: string[];
	b2b: "signal" | "unqualified" | "consumer-excluded";
	contactPriority: "high" | "medium" | "low" | "missing";
	contactCompleteness: number;
	recommendedLanguage: string;
	recommendedReason: string;
	companySize: string;
	purchaseNeeds: string;
	importStatus: string;
};
export type LeadIntel = {
	sources: SourceEvidence[];
	contacts: ContactEvidence[];
	manual: ManualProfile;
	analysis: LeadAnalysis;
	targetCountry: string;
	mergedInto?: string;
	history?: {
		id: string;
		kind: string;
		data: Record<string, unknown>;
		createdAt: string;
	}[];
};
export type SearchTask = {
	id: string;
	kind: "search" | "enrichment";
	state:
		| "queued"
		| "running"
		| "succeeded"
		| "partial"
		| "failed"
		| "cancelled"
		| "interrupted";
	query: DiscoveryQuery;
	createdAt: string;
	startedAt?: string;
	finishedAt?: string;
	attempts: number;
	usage: number;
	errors: { engine: string; code: string; message: string }[];
	results?: string[];
	cacheHit?: boolean;
	counts?: { returned: number; excluded: number; merged: number };
	result?: Record<string, unknown>;
	savedFilter?: Record<string, string>;
};
export const defaultWeights: ScoreWeights = {
	product: 25,
	business: 20,
	whatsapp: 20,
	oem: 15,
	activity: 10,
	imports: 10,
};
