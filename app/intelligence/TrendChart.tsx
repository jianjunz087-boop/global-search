import type { Observation } from "@/lib/intelligence/adapters";
type Point = Pick<Observation, "country" | "product" | "unit" | "value"> & {
	period: string;
	name: string;
	method: string;
};
/** Keep differently defined metrics and countries on separate axes. */
export default function TrendChart({
	observations,
}: {
	observations: Point[];
}) {
	const groups = new Map<string, Point[]>();
	for (const o of observations) {
		const k = [o.country, o.product, o.name, o.unit, o.method].join(" · ");
		groups.set(k, [...(groups.get(k) ?? []), o]);
	}
	return (
		<>
			{Array.from(groups, ([label, points]) => {
				const sorted = [...points].sort((a, b) =>
					a.period.localeCompare(b.period),
				);
				const max = Math.max(1, ...sorted.map((o) => o.value));
				return (
					<figure key={label}>
						<figcaption>
							{label} · User-supplied observations, unverified
						</figcaption>
						<svg
							viewBox="0 0 650 180"
							role="img"
							aria-label={`${label} trend`}
							style={{ width: "100%", maxHeight: 200 }}
						>
							<path d="M40 10V150H620" fill="none" stroke="#b6cfc1" />
							<polyline
								points={sorted
									.map(
										(p, i) =>
											`${50 + (i * 550) / Math.max(1, sorted.length - 1)},${140 - (p.value / max) * 115}`,
									)
									.join(" ")}
								fill="none"
								stroke="#3e8975"
								strokeWidth="2"
							/>
							{sorted.map((p, i) => (
								<g key={`${p.period}-${i}`}>
									<circle
										cx={50 + (i * 550) / Math.max(1, sorted.length - 1)}
										cy={140 - (p.value / max) * 115}
										r="4"
										fill="#3e8975"
									/>
									<text
										x={50 + (i * 550) / Math.max(1, sorted.length - 1)}
										y={130 - (p.value / max) * 115}
										fontSize="10"
									>
										{p.value}
									</text>
									<text
										x={40 + (i * 550) / Math.max(1, sorted.length - 1)}
										y="170"
										fontSize="9"
									>
										{p.period}
									</text>
								</g>
							))}
						</svg>
					</figure>
				);
			})}
		</>
	);
}
