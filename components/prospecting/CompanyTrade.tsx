"use client";
import { countryFor } from "@/lib/countries";
import { useState, useEffect } from "react";
import { liveCountries } from "@/lib/intelligence/live-model";
import type { Lead } from "@/lib/leads";
export default function CompanyTrade({
	lead,
	zh,
}: {
	lead: Lead;
	zh: boolean;
}) {
	const t = (a: string, b: string) => (zh ? b : a);
	const initial =
		lead.intel?.manual.country ||
		lead.targetCountry ||
		lead.intel?.targetCountry ||
		lead.country;
	const [country, setCountry] = useState(
			liveCountries.find((c) => c.geo === countryFor(initial)?.code)?.name ??
				"Russia",
		),
		[hs, setHS] = useState("670419"),
		[product, setProduct] = useState("DIY Cluster Lashes"),
		[years, setYears] = useState(3),
		[data, setData] = useState<any>({ records: [], partners: [] }),
		[error, setError] = useState(""),
		[busy, setBusy] = useState(false);
	useEffect(() => {
		fetch(
			"/api/prospecting/trade?country=" +
				encodeURIComponent(country) +
				"&product=" +
				encodeURIComponent(product),
		)
			.then((r) => r.json())
			.then(setData)
			.catch(() => setError("Trade database unavailable"));
	}, [country, product]);
	async function collect(scope: "annual" | "partners") {
		setBusy(true);
		setError("");
		try {
			const latest = new Date().getFullYear() - 1;
			const r = await fetch("/api/prospecting/trade", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					country,
					hsCode: hs,
					years:
						scope === "partners"
							? [latest]
							: Array.from({ length: years }, (_, i) => latest - years + i + 1),
					scope,
				}),
			});
			const d = await r.json();
			if (!r.ok) throw new Error(d.error);
			setData(d);
		} catch (e) {
			setError(e instanceof Error ? e.message : "Trade query failed");
		} finally {
			setBusy(false);
		}
	}
	const records = (data.records ?? [])
		.filter((r: any) => r.hsCode === hs)
		.sort((a: any, b: any) => a.year - b.year);
	return (
		<details className="prospect-trade">
			<summary>
				{t("Import volume & purchasing capacity", "进口量与采购能力分析")}
			</summary>
			<p>
				<b>
					{lead.intel?.manual.corporateImports?.length
						? t(
								"Operator-reviewed company documents attached below",
								"下方有人工核对的企业文件",
							)
						: t(
								"No company-level import records / 暂无企业级进口数据",
								"暂无企业级进口数据",
							)}
				</b>
			</p>
			<p>
				{t(
					"National HS values below are market background only, never this company’s imports or purchasing budget. No market-size estimate is made for eyelash products.",
					"下方国家HS数据仅为市场背景，不是该公司的进口额或采购预算。不提供假睫毛专属市场规模估算。",
				)}
			</p>
			<div className="prospect-grid">
				<label>
					Country
					<select value={country} onChange={(e) => setCountry(e.target.value)}>
						{liveCountries.map((c) => (
							<option key={c.geo}>{c.name}</option>
						))}
					</select>
				</label>
				<label>
					Product scope
					<select value={product} onChange={(e) => setProduct(e.target.value)}>
						{[
							"DIY Cluster Lashes",
							"Strip Lashes",
							"Human-hair Lashes",
							"DIY Lash Kits",
							"Lash Glue",
							"Bond & Seal",
							"Remover",
							"Tweezers",
							"Brushes",
						].map((p) => (
							<option key={p}>{p}</option>
						))}
					</select>
				</label>
				<label>
					Candidate HS · pending verification
					<select value={hs} onChange={(e) => setHS(e.target.value)}>
						{["670419", "670420", "670490"].map((x) => (
							<option key={x}>{x}</option>
						))}
					</select>
				</label>
				<label>
					Years
					<select
						value={years}
						onChange={(e) => setYears(Number(e.target.value))}
					>
						<option value={3}>3</option>
						<option value={5}>5</option>
					</select>
				</label>
			</div>
			<p>
				{data.candidates?.state ?? "HS applicability pending verification"} ·{" "}
				{data.candidates?.reason ??
					"Broad hair-article headings include other products; DIY clusters are not separately identifiable."}
			</p>
			{/glue|bond|seal|remover|tweezer|brush|kit/i.test(product) ? (
				<p className="prospect-warning">
					{t(
						"This product requires a separate classification. Hair-article query disabled to prevent mixing glue, tools and kits with lashes.",
						"该产品需要单独核实海关分类；已禁止套用毛发制品编码，避免将胶水、工具和套装混为一谈。",
					)}
				</p>
			) : (
				<div className="prospect-actions">
					<button disabled={busy} onClick={() => collect("annual")}>
						{busy
							? "Querying…"
							: t("Collect annual national background", "采集国家年度背景")}
					</button>
					<button disabled={busy} onClick={() => collect("partners")}>
						{t("Collect returned partner sample", "采集供应伙伴样本")}
					</button>
				</div>
			)}
			{error && <p role="alert">{error}</p>}
			{records.length ? (
				<div className="prospect-scroll">
					<table>
						<thead>
							<tr>
								<th>Year</th>
								<th>Broad-category USD</th>
								<th>Quantity / unit</th>
								<th>YoY</th>
								<th>Scope / source</th>
							</tr>
						</thead>
						<tbody>
							{records.map((r: any) => (
								<tr key={r.id}>
									<td>{r.year}</td>
									<td>{r.value?.toLocaleString("en-US")}</td>
									<td>
										{r.quantity ?? "Unknown"} {r.quantityUnit ?? ""}
										{r.quantityEstimated === true ? " · estimated" : ""}
									</td>
									<td>
										{r.yoy === null || r.yoy === undefined
											? "Unknown"
											: r.yoy + "%"}
										<small>{r.yoyNote}</small>
									</td>
									<td>
										<a href={r.sourceUrl} target="_blank" rel="noreferrer">
											{r.hsCode} · {r.classification}
										</a>
										<small>
											{r.description} · {r.collectedAt}
										</small>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			) : (
				<p>
					{t(
						"No stored annual records. Missing years/quantities remain unknown, not zero.",
						"暂无年度记录。缺失年份和数量保持未知，不填零。",
					)}
				</p>
			)}
			{data.missingYears?.length > 0 && (
				<p>Missing years: {data.missingYears.join(", ")}</p>
			)}
			{data.partners?.map((p: any) => (
				<p key={p.id}>
					{p.partner} · {p.year} · {p.value.toLocaleString("en-US")} USD ·{" "}
					<a href={p.sourceUrl} target="_blank" rel="noreferrer">
						Source
					</a>
				</p>
			))}
			<p>
				{data.coverage ??
					"Public preview ≤500 rows, no completeness guarantee; comparison is suppressed when HS revisions change."}
			</p>
		</details>
	);
}
