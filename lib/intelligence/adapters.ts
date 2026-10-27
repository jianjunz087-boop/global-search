/** Server-only source contract. Never expose API credentials in adapter metadata. */
export type EvidenceKind =
	| "official"
	| "third-party-estimate"
	| "public-price"
	| "system-inference"
	| "demo";
export type Observation = {
	id: string;
	sourceUrl: string;
	collectedAt: string;
	periodStart: string;
	periodEnd: string;
	method: string;
	limitations: string;
	kind: EvidenceKind;
	country: string;
	product: string;
	metric: string;
	value: number;
	unit: string;
};
export interface SourceAdapter {
	id: string;
	status(): { configured: boolean; method: string; restrictions: string };
	collect(query: {
		country: string;
		product: string;
		from: string;
		to: string;
	}): Promise<Observation[]>;
}
export class UnconfiguredAdapter implements SourceAdapter {
	constructor(public id: string) {}
	status() {
		return {
			configured: false,
			method: "Not implemented",
			restrictions: "Requires a licensed provider and verified metric mapping",
		};
	}
	async collect(): Promise<Observation[]> {
		throw new Error(`${this.id} is not configured; no collection performed`);
	}
}
export const adapters: SourceAdapter[] = [
	new UnconfiguredAdapter("comtrade"),
	new UnconfiguredAdapter("google-trends"),
];
