"use client";
import { useEffect, useState } from "react";
import {
	Buyer,
	Market,
	csv,
	parseCSV,
	score,
	factors,
	products,
} from "@/lib/intelligence/model";
import "./workspace.css";
import TrendChart from "./TrendChart";
const tabs = [
	"Dashboard",
	"Markets",
	"Products",
	"Competitors",
	"B2B Leads",
	"Advertising",
	"Reports",
	"Data Sources",
	"Settings",
];
const zh = [
	"仪表盘",
	"国家市场",
	"产品分析",
	"竞争品牌",
	"企业客户",
	"广告建议",
	"市场报告",
	"数据来源",
	"设置",
];
const buyerFields = [
	"name",
	"country",
	"website",
	"type",
	"email",
	"phone",
	"social",
	"products",
	"brand",
	"source",
	"potential",
	"status",
	"lastContact",
	"nextFollowUp",
	"note",
] as const;
type Observation = {
	id: string;
	name: string;
	country: string;
	product: string;
	period: string;
	unit: string;
	method: string;
	limitations: string;
	sourceUrl: string;
	value: number;
	collectedAt: string;
};
type Data = {
	observations: Observation[];
	competitors: Record<string, string>[];
	markets: Market[];
	buyers: Buyer[];
	settings: { weights: number[]; reminders: string };
	sources: {
		name: string;
		configured: boolean;
		url: string;
		method: string;
		range: string;
		restriction: string;
		lastCollected: string | null;
	}[];
};
const emptyBuyer = () =>
	Object.fromEntries(
		buyerFields.map((k) => [
			k,
			k === "type" ? "Wholesaler" : k === "status" ? "New" : "",
		]),
	) as unknown as Buyer;
function download(
	name: string,
	content: BlobPart,
	type = "text/csv;charset=utf-8",
) {
	const url = URL.createObjectURL(new Blob([content], { type }));
	const a = document.createElement("a");
	a.href = url;
	a.download = name;
	a.click();
	setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export default function Intelligence() {
	const [data, setData] = useState<Data | null>(null),
		[tab, setTab] = useState("Dashboard"),
		[cn, setCn] = useState(false),
		[error, setError] = useState(""),
		[notice, setNotice] = useState(""),
		[q, setQ] = useState(""),
		[country, setCountry] = useState(""),
		[type, setType] = useState(""),
		[sort, setSort] = useState("score"),
		[selected, setSelected] = useState<string[]>([]),
		[buyer, setBuyer] = useState<Buyer | null>(null),
		[detail, setDetail] = useState<Market | null>(null),
		[weights, setWeights] = useState([25, 20, 15, 20, 10, 10]),
		[reminders, setReminders] = useState(""),
		[product, setProduct] = useState(products[0]),
		[period, setPeriod] = useState("90 days"),
		[source, setSource] = useState("All sources"),
		[busy, setBusy] = useState(false),
		[report, setReport] = useState(false),
		[record, setRecord] = useState<Record<string, string> | null>(null),
		[recordKind, setRecordKind] = useState("observation"),
		[buyerSelected, setBuyerSelected] = useState<string[]>([]),
		[buyerSort, setBuyerSort] = useState("name");
	async function load() {
		const r = await fetch("/api/intelligence");
		const d = await r.json();
		if (!r.ok) throw new Error(d.error);
		setError("");
		setData(d);
		setWeights(d.settings.weights);
		setReminders(
			typeof d.settings.reminders === "string" ? d.settings.reminders : "",
		);
	}
	useEffect(() => {
		load().catch((e) => setError(e.message));
	}, []);
	async function save(payload: unknown) {
		setBusy(true);
		setError("");
		try {
			const r = await fetch("/api/intelligence", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			const d = await r.json();
			if (!r.ok) throw new Error(d.error);
			await load();
			setNotice(
				`Saved ${d.saved ?? ""}${d.duplicates ? `; skipped ${d.duplicates} duplicate domains` : ""}`,
			);
			return true;
		} catch (e) {
			setError(e instanceof Error ? e.message : "Request failed");
			return false;
		} finally {
			setBusy(false);
		}
	}
	const markets = (data?.markets ?? [])
		.filter(
			(m) =>
				m.name.toLowerCase().includes(q.toLowerCase()) &&
				(!country || m.name === country),
		)
		.sort((a, b) =>
			sort === "name"
				? a.name.localeCompare(b.name)
				: (score(b.values, weights).score ?? -1) -
					(score(a.values, weights).score ?? -1),
		);
	const buyers = (data?.buyers ?? [])
		.filter(
			(b) =>
				JSON.stringify(b).toLowerCase().includes(q.toLowerCase()) &&
				(!country || b.country === country) &&
				(!type || b.type === type),
		)
		.sort((a, b) =>
			String(a[buyerSort as keyof Buyer] ?? "").localeCompare(
				String(b[buyerSort as keyof Buyer] ?? ""),
			),
		);
	const compared = (data?.markets ?? []).filter((m) => selected.includes(m.id));
	function exportBuyers() {
		download(
			"b2b-leads.csv",
			csv([
				["id", ...buyerFields, "collectedAt"],
				...buyers.map((b) => [
					"",
					...buyerFields.map((k) => b[k]),
					b.collectedAt,
				]),
			]),
		);
	}
	async function importFile(file: File) {
		try {
			let rows: string[][];
			if (file.name.toLowerCase().endsWith(".xlsx")) {
				const ExcelJS = await import("exceljs");
				const wb = new ExcelJS.Workbook();
				await wb.xlsx.load(await file.arrayBuffer());
				rows = [];
				wb.worksheets[0].eachRow((row) => {
					rows.push(
						Array.from({ length: row.cellCount }, (_, i) =>
							String(row.getCell(i + 1).text),
						),
					);
				});
			} else rows = parseCSV(await file.text());
			const headers =
				rows.shift()?.map((h) => h.replace(/^\uFEFF/, "").trim()) ?? [];
			await save({
				kind: "buyers",
				items: rows.map((r) =>
					Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])),
				),
			});
		} catch (e) {
			setError(e instanceof Error ? e.message : "Import failed");
		}
	}
	async function excelExport() {
		const ExcelJS = await import("exceljs");
		const wb = new ExcelJS.Workbook();
		const sheet = wb.addWorksheet("B2B leads");
		sheet.addRow(buyerFields);
		buyers.forEach((b) =>
			sheet.addRow(
				buyerFields.map((k) => {
					const s = b[k] ?? "";
					return /^[=+@\-]/.test(s) ? "'" + s : s;
				}),
			),
		);
		download(
			"b2b-leads.xlsx",
			await wb.xlsx.writeBuffer(),
			"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
		);
	}
	return (
		<div className="mi">
			<aside>
				<div className="mi-logo">
					B<span>✦</span>
				</div>
				<strong>BAIHUA SHIJIE</strong>
				<small>EYELASH · MARKET INTELLIGENCE</small>
				<nav>
					{tabs.map((t, i) => (
						<button
							key={t}
							className={tab === t ? "active" : ""}
							onClick={() => {
								setTab(t);
								setQ("");
								setCountry("");
								setReport(false);
							}}
						>
							<span>{["◈", "◎", "▤", "◇", "♧", "↗", "▧", "⌘", "⚙"][i]}</span>
							{cn ? zh[i] : t}
						</button>
					))}
				</nav>
				<small>
					Qingdao, China
					<br />
					B2B EXPORT · OEM / ODM
				</small>
				<a href="/">Existing discovery CRM ↗</a>
			</aside>
			<main>
				<header>
					<div>
						<small>GLOBAL EYELASH MARKET INTELLIGENCE</small>
						<h1>{cn ? zh[tabs.indexOf(tab)] : tab}</h1>
					</div>
					<button onClick={() => setCn(!cn)}>
						{cn ? "English" : "简体中文"}
					</button>
				</header>
				<div className="mi-banner">
					{cn
						? "演示市场评分，仅供功能验证；没有实测销量、进口额或真实客户种子数据。"
						: "DEMO MARKET SCENARIOS · Illustrative scores, not measured demand, sales or import value. No seeded companies or contacts."}
				</div>
				{error && (
					<div role="alert" className="mi-error">
						{error}
						<button onClick={() => load().catch((e) => setError(e.message))}>
							Retry
						</button>
					</div>
				)}
				{notice && <p role="status">{notice}</p>}
				{!data && !error && <p>Loading database…</p>}
				{data && (
					<>
						{["Dashboard", "Markets"].includes(tab) && (
							<>
								<div className="mi-stats">
									{[
										[data.markets.length, "Markets in directory"],
										[data.buyers.length, "Source-linked B2B leads"],
										[products.length, "Product categories"],
										[0, "Verified market observations"],
									].map(([n, label]) => (
										<article key={label}>
											<small>{label}</small>
											<b>{n}</b>
											<span>
												Current database ·{" "}
												{label === "Verified market observations"
													? "External feeds pending"
													: "MVP"}
											</span>
										</article>
									))}
								</div>
								<section>
									<div className="mi-section">
										<div>
											<h2>
												{cn ? "市场机会排名" : "Market opportunity ranking"}
											</h2>
											<p>
												Transparent scenarios to explore your export strategy.
											</p>
										</div>
										<button
											onClick={() =>
												setDetail({
													id: "",
													name: "",
													language: "",
													values: [],
													note: "",
													kind: "manual",
													updatedAt: "",
												})
											}
										>
											+ Add country
										</button>
									</div>
									<div className="mi-filters">
										<input
											aria-label="Search markets"
											placeholder="Search country…"
											value={q}
											onChange={(e) => setQ(e.target.value)}
										/>
										<select
											aria-label="Sort markets"
											value={sort}
											onChange={(e) => setSort(e.target.value)}
										>
											<option value="score">Opportunity score ↓</option>
											<option value="name">Country A–Z</option>
										</select>
										<button
											onClick={() =>
												download(
													"market-ranking.csv",
													csv([
														[
															"country",
															"scenario score",
															"coverage",
															"classification",
															"updated",
														],
														...markets.map((m) => [
															m.name,
															score(m.values, weights).score,
															score(m.values, weights).coverage,
															m.kind,
															m.updatedAt,
														]),
													]),
												)
											}
										>
											Export CSV
										</button>
									</div>
									<div className="mi-table">
										<table>
											<thead>
												<tr>
													<th>Compare</th>
													<th>Market / language</th>
													<th>Opportunity</th>
													<th>Coverage</th>
													<th>Classification</th>
													<th>Updated</th>
												</tr>
											</thead>
											<tbody>
												{markets.map((m, i) => (
													<tr key={m.id}>
														<td>
															<input
																aria-label={`Compare ${m.name}`}
																type="checkbox"
																checked={selected.includes(m.id)}
																onChange={(e) =>
																	setSelected(
																		e.target.checked
																			? [...selected, m.id]
																			: selected.filter((id) => id !== m.id),
																	)
																}
															/>
														</td>
														<td>
															<button
																className="mi-link"
																onClick={() => setDetail(m)}
															>
																{i + 1}. {m.name}
															</button>
															<small>{m.language}</small>
														</td>
														<td>
															<b>
																{score(m.values, weights).score ?? "Unknown"}
															</b>
															<div className="mi-track">
																<i
																	style={{
																		width: `${score(m.values, weights).score ?? 0}%`,
																	}}
																/>
															</div>
														</td>
														<td>{score(m.values, weights).coverage}%</td>
														<td>
															<em>
																{m.kind === "demo"
																	? "DEMO"
																	: "Manual · incomplete"}
															</em>
														</td>
														<td>{m.updatedAt.slice(0, 10)}</td>
													</tr>
												))}
											</tbody>
										</table>
										{!markets.length && <p>No matching countries.</p>}
									</div>
								</section>
								<section>
									<h2>
										Country comparison <small>{compared.length} selected</small>
									</h2>
									{!compared.length ? (
										<p>
											Select countries above to compare all six score
											components.
										</p>
									) : (
										<div className="mi-grid">
											{compared.map((m) => (
												<article key={m.id}>
													<h3>{m.name} · DEMO / MANUAL</h3>
													{factors.map((f, i) => (
														<div key={f}>
															{f}: {m.values[i] ?? "Unknown"}
															<div className="mi-track">
																<i style={{ width: `${m.values[i] ?? 0}%` }} />
															</div>
														</div>
													))}
												</article>
											))}
										</div>
									)}
								</section>
							</>
						)}
						{tab === "Products" && (
							<section>
								<div className="mi-section">
									<h2>Product opportunity explorer</h2>
									<button
										onClick={() => {
											setRecordKind("observation");
											setRecord({
												name: "",
												country: country || "United States",
												product,
												period: new Date().toISOString().slice(0, 10),
												value: "",
												unit: "",
												sourceUrl: "",
												method: "",
												limitations: "",
											});
										}}
									>
										+ Add sourced observation
									</button>
								</div>
								<div className="mi-filters">
									<select
										value={product}
										onChange={(e) => setProduct(e.target.value)}
									>
										{products.map((p) => (
											<option key={p}>{p}</option>
										))}
									</select>
									<select
										value={country}
										onChange={(e) => setCountry(e.target.value)}
									>
										<option value="">All countries</option>
										{data.markets.map((m) => (
											<option key={m.id}>{m.name}</option>
										))}
									</select>
									<select
										value={period}
										onChange={(e) => setPeriod(e.target.value)}
									>
										{["30 days", "90 days", "12 months"].map((p) => (
											<option key={p}>{p}</option>
										))}
									</select>
									<select
										value={source}
										onChange={(e) => setSource(e.target.value)}
									>
										{[
											"All sources",
											"Google Trends",
											"UN Comtrade",
											"Public prices",
										].map((p) => (
											<option key={p}>{p}</option>
										))}
									</select>
								</div>
								<h3>
									{product} · {country || "Global"} · {period}
								</h3>
								<TrendChart
									observations={data.observations.filter(
										(o) =>
											o.product === product &&
											(!country || o.country === country) &&
											new Date(o.period).getTime() >=
												Date.now() -
													(period === "30 days"
														? 30
														: period === "90 days"
															? 90
															: 366) *
														86400000 &&
											(source === "All sources" ||
												o.name.toLowerCase().includes(source.toLowerCase())),
									)}
								/>
								{data.observations
									.filter(
										(o) =>
											o.product === product &&
											(!country || o.country === country) &&
											new Date(o.period).getTime() >=
												Date.now() -
													(period === "30 days"
														? 30
														: period === "90 days"
															? 90
															: 366) *
														86400000 &&
											(source === "All sources" ||
												o.name.toLowerCase().includes(source.toLowerCase())),
									)
									.sort((a, b) => a.period.localeCompare(b.period))
									.map((o) => (
										<article key={o.id}>
											<b>
												{o.period} · {o.country} · {o.value} {o.unit}
											</b>
											<p>
												{o.name} · user-supplied observation, unverified ·
												collected {o.collectedAt}
											</p>
											<a href={o.sourceUrl} target="_blank" rel="noreferrer">
												Source ↗
											</a>
											<p>
												Method: {o.method}. Limitations: {o.limitations}
											</p>
											<meter
												min={0}
												max={Math.max(o.value, 100)}
												value={o.value}
												aria-label={`${o.value} ${o.unit}`}
											/>
										</article>
									))}
								<div className="mi-empty">
									External feed not connected for {source}.<br />
									Connect a licensed source before rendering a trend chart.
									Search interest and public prices must not be presented as
									sales.
								</div>
								<p>
									Research checklist: local product naming, wholesale MOQ,
									packaging, adhesive ingredients, importer requirements and
									dated source URLs.
								</p>
							</section>
						)}
						{tab === "B2B Leads" && (
							<section>
								<div className="mi-section">
									<h2>B2B customer workspace</h2>
									<button onClick={() => setBuyer(emptyBuyer())}>
										+ Add buyer
									</button>
								</div>
								<div className="mi-filters">
									<input
										aria-label="Search buyers"
										placeholder="Search companies, notes, products…"
										value={q}
										onChange={(e) => setQ(e.target.value)}
									/>
									<select
										value={country}
										onChange={(e) => setCountry(e.target.value)}
									>
										<option value="">All countries</option>
										{data.markets.map((m) => (
											<option key={m.id}>{m.name}</option>
										))}
									</select>
									<select
										value={type}
										onChange={(e) => setType(e.target.value)}
									>
										<option value="">All B2B types</option>
										{[
											"Importer",
											"Wholesaler",
											"Distributor",
											"Brand",
											"Beauty supplier",
										].map((t) => (
											<option key={t}>{t}</option>
										))}
									</select>
									<select
										aria-label="Sort buyers"
										value={buyerSort}
										onChange={(e) => setBuyerSort(e.target.value)}
									>
										<option value="name">Company A–Z</option>
										<option value="country">Country</option>
										<option value="nextFollowUp">Follow-up date</option>
										<option value="status">Status</option>
									</select>
									<button
										disabled={!buyerSelected.length || busy}
										onClick={async () => {
											if (
												await save({
													kind: "buyers",
													items: data.buyers
														.filter((b) => buyerSelected.includes(b.id))
														.map((b) => ({ ...b, status: "Qualified" })),
												})
											)
												setBuyerSelected([]);
										}}
									>
										Qualify selected ({buyerSelected.length})
									</button>
									<button onClick={exportBuyers}>CSV</button>
									<button onClick={excelExport}>Excel</button>
									<label className="mi-upload">
										Import CSV / XLSX
										<input
											type="file"
											accept=".csv,.xlsx"
											onChange={(e) => {
												if (e.target.files?.[0])
													void importFile(e.target.files[0]);
												e.target.value = "";
											}}
										/>
									</label>
									<button
										onClick={() =>
											download("buyer-template.csv", csv([buyerFields]))
										}
									>
										Template
									</button>
								</div>
								<p>
									Import requires name, country, website, type and source URL.
									Domain duplicates are skipped. Import public business contacts
									only.
								</p>
								<div className="mi-table">
									<table>
										<thead>
											<tr>
												<th>Select</th>
												<th>Company</th>
												<th>Country / type</th>
												<th>Status</th>
												<th>Follow-up</th>
												<th>Evidence</th>
											</tr>
										</thead>
										<tbody>
											{buyers.map((b) => (
												<tr key={b.id}>
													<td>
														<input
															type="checkbox"
															aria-label={`Select ${b.name}`}
															checked={buyerSelected.includes(b.id)}
															onChange={(e) =>
																setBuyerSelected(
																	e.target.checked
																		? [...buyerSelected, b.id]
																		: buyerSelected.filter((id) => id !== b.id),
																)
															}
														/>
													</td>
													<td>
														<button
															className="mi-link"
															onClick={() => setBuyer(b)}
														>
															{b.name}
														</button>
														<small>{b.website}</small>
													</td>
													<td>
														{b.country}
														<small>{b.type}</small>
													</td>
													<td>{b.status}</td>
													<td>{b.nextFollowUp || "Not set"}</td>
													<td>
														<a href={b.source} target="_blank" rel="noreferrer">
															Public source ↗
														</a>
														<small>
															{b.collectedAt?.slice(0, 10)} · user supplied,
															unverified
														</small>
													</td>
												</tr>
											))}
										</tbody>
									</table>
									{!buyers.length && (
										<div className="mi-empty">
											No buyers yet. Add a source-linked business or import your
											verified company list.
										</div>
									)}
								</div>
							</section>
						)}
						{tab === "Competitors" && (
							<section>
								<div className="mi-section">
									<h2>Competitor evidence register</h2>
									<button
										onClick={() => {
											setRecordKind("competitor");
											setRecord({
												name: "",
												country: "",
												product: "",
												sourceUrl: "",
												channel: "",
												price: "",
												currency: "",
												packaging: "",
												promotion: "",
											});
										}}
									>
										+ Add public brand observation
									</button>
								</div>
								{data.competitors.map((c) => (
									<article key={c.id}>
										<h3>
											{c.name} · {c.country}
										</h3>
										<p>
											{c.product || "Product unknown"} ·{" "}
											{c.channel || "Channel unknown"} ·{" "}
											{c.price ? `${c.price} ${c.currency}` : "Price unknown"}
										</p>
										<p>
											Packaging: {c.packaging || "Unknown"} · Promotion:{" "}
											{c.promotion || "Unknown"}
										</p>
										<a href={c.sourceUrl} target="_blank" rel="noreferrer">
											Public source ↗
										</a>
										<p>Recorded {c.collectedAt} · user supplied, unverified</p>
									</article>
								))}
								<div className="mi-empty">
									External brand collection is not configured. Manually recorded
									sources are shown above.
								</div>
								<p>
									Brand sites, channel, product family, public price / currency,
									packaging, promotion, target country and checked date require
									a dated public source. Unknown fields remain unknown.
									Competitor collection is pending a licensed adapter.
								</p>
							</section>
						)}
						{tab === "Advertising" && (
							<section>
								<h2>Facebook / Instagram B2B test brief</h2>
								<div className="mi-filters">
									<select
										value={country}
										onChange={(e) => setCountry(e.target.value)}
									>
										<option value="">Choose country</option>
										{data.markets.map((m) => (
											<option key={m.id}>{m.name}</option>
										))}
									</select>
									<select
										value={product}
										onChange={(e) => setProduct(e.target.value)}
									>
										{products.map((p) => (
											<option key={p}>{p}</option>
										))}
									</select>
								</div>
								<article>
									<em>SYSTEM RECOMMENDATION · UNTESTED HYPOTHESIS</em>
									<h3>
										{country || "Select a market"} / {product}
									</h3>
									<p>
										Audience: importers, distributors, wholesalers and
										private-label beauty brands.
									</p>
									<p>
										Language:{" "}
										{data.markets.find((m) => m.name === country)?.language ||
											"Select a country"}
										; native review required.
									</p>
									<p>
										Creative: factory production, product specification
										comparison, OEM packaging and sample process. Ask: company
										website, business type, target quantity, destination
										country, product specifications and consent to follow-up.
									</p>
									<p>
										Budget / conversion rate: unknown, pending a controlled test
										and business-approved spend.
									</p>
									<p>
										WhatsApp: only after permission, confirm company and
										sourcing requirements, offer catalogue, record next
										follow-up; stop on opt-out.
									</p>
								</article>
							</section>
						)}
						{tab === "Reports" && (
							<section>
								<div className="mi-section">
									<h2>{cn ? "市场报告中心" : "Market report center"}</h2>
									<button onClick={() => setReport(true)}>
										Generate {cn ? "中文" : "English"} report
									</button>
								</div>
								{report && (
									<div id="mi-report">
										<h2>
											BAIHUA SHIJIE EYELASH ·{" "}
											{cn ? "市场研究报告" : "Market intelligence report"}
										</h2>
										<p>
											{new Date().toISOString()} ·{" "}
											{cn
												? "演示评分，不代表实际市场排名"
												: "Scenario ranking, not measured market ranking"}
										</p>
										<ol>
											{markets.map((m) => (
												<li key={m.id}>
													{m.name}:{" "}
													{score(m.values, weights).score ?? "Unknown"} / 100 ·{" "}
													{m.kind}
												</li>
											))}
										</ol>
										<h3>{cn ? "产品与竞品" : "Products and competitors"}</h3>
										<p>
											{cn
												? "暂无经验证的趋势或竞品观测。"
												: "External feeds are not connected. Manually recorded observations are listed below."}
										</p>
										<h3>
											{cn ? "企业客户及来源" : "B2B companies and sources"}
										</h3>
										{data.observations.map((o) => (
											<p key={o.id}>
												{o.country} · {o.product} · {o.period}: {o.value}{" "}
												{o.unit} · {o.sourceUrl} · {o.method} · {o.limitations}{" "}
												· user supplied
											</p>
										))}
										{data.competitors.map((c) => (
											<p key={c.id}>
												{c.name} · {c.country} · {c.price || "Price unknown"}{" "}
												{c.currency} · {c.sourceUrl} · user supplied
											</p>
										))}
										{data.buyers.map((b) => (
											<p key={b.id}>
												{b.name} · {b.country} · {b.source}
											</p>
										))}
										<p>
											{cn
												? "风险：HS 编码可能包含其他美容产品；需核实进口合规、付款与物流条件。建议先验证来源，再开展小规模 B2B 开发。"
												: "Risks: broad HS codes are not eyelash sales. Verify importer compliance, payments and logistics. Next: collect dated sources, verify buyers and run permission-based B2B tests."}
										</p>
										<button onClick={() => window.print()}>
											Print / Save as PDF
										</button>
										<button
											onClick={() =>
												download(
													"market-report.csv",
													csv([
														["country", "scenario score", "evidence"],
														...markets.map((m) => [
															m.name,
															score(m.values, weights).score,
															m.note,
														]),
													]),
												)
											}
										>
											Export CSV
										</button>
									</div>
								)}
							</section>
						)}
						{tab === "Data Sources" && (
							<section>
								<h2>Source transparency & API configuration</h2>
								<p>
									No background search or collection has been performed by this
									module.
								</p>
								{data.sources.map((s) => (
									<article key={s.name}>
										<div className="mi-section">
											<h3>{s.name}</h3>
											<em>
												{s.configured
													? "Key present · request not verified"
													: "Not configured"}
											</em>
										</div>
										<a href={s.url} target="_blank" rel="noreferrer">
											{s.url}
										</a>
										<p>
											Method: {s.method} · Period: {s.range} · Last collected:{" "}
											{s.lastCollected ?? "Never"}
										</p>
										<p>{s.restriction}</p>
									</article>
								))}
								<p>
									SerpAPI: set SERPAPI_API_KEY in server environment settings,
									restart, and use the existing discovery CRM. Keys never enter
									browser code. UN Comtrade / Trends adapters are not
									implemented; keys alone do not enable them.
								</p>
							</section>
						)}
						{tab === "Settings" && (
							<section>
								<h2>Opportunity model</h2>
								<p>
									Weighted mean of available 0–100 components. Missing factors
									are excluded and coverage falls. Higher safety / headroom
									means lower risk / pressure. All seeded inputs are synthetic,
									not official statistics or predictions.
								</p>
								{factors.map((f, i) => (
									<label className="mi-setting" key={f}>
										{f}
										<input
											type="number"
											min="0"
											max="100"
											value={weights[i]}
											onChange={(e) =>
												setWeights(
													weights.map((w, j) =>
														j === i ? Number(e.target.value) : w,
													),
												)
											}
										/>{" "}
										%
									</label>
								))}
								<p>
									Total: {weights.reduce((a, b) => a + b, 0)}% (must equal 100)
								</p>
								<h3>Monitoring preferences</h3>
								<textarea
									aria-label="Monitoring preferences"
									placeholder="Weekly market report, country / brand changes, follow-up reminders…"
									value={reminders}
									onChange={(e) => setReminders(e.target.value)}
								/>
								<p>
									Scheduler not deployed. Preferences are stored only; no
									scheduled report, notification or email will run. Follow-up
									dates remain visible in B2B Leads.
								</p>
								<button
									disabled={busy}
									onClick={() =>
										save({ kind: "settings", item: { weights, reminders } })
									}
								>
									Save settings
								</button>
								<p>
									Database: server-side PostgreSQL or persistent PGlite. No
									authentication in this MVP: restrict access before using real
									customer data.
								</p>
							</section>
						)}
					</>
				)}
				{buyer && (
					<div
						className="mi-modal"
						role="dialog"
						aria-modal="true"
						aria-label="Buyer editor"
					>
						<form
							onSubmit={async (e) => {
								e.preventDefault();
								if (await save({ kind: "buyers", items: [buyer] }))
									setBuyer(null);
							}}
						>
							<h2>{buyer.id ? "Edit buyer" : "Add B2B buyer"}</h2>
							<div className="mi-grid">
								{buyerFields.map((f) => (
									<label key={f}>
										{f}
										{f === "type" ? (
											<select
												value={buyer[f]}
												onChange={(e) =>
													setBuyer({ ...buyer, [f]: e.target.value })
												}
											>
												{[
													"Importer",
													"Wholesaler",
													"Distributor",
													"Brand",
													"Beauty supplier",
												].map((t) => (
													<option key={t}>{t}</option>
												))}
											</select>
										) : (
											<input
												required={[
													"name",
													"country",
													"website",
													"source",
												].includes(f)}
												type={
													["website", "source", "social"].includes(f)
														? "url"
														: f === "email"
															? "email"
															: ["lastContact", "nextFollowUp"].includes(f)
																? "date"
																: "text"
												}
												value={buyer[f] ?? ""}
												onChange={(e) =>
													setBuyer({ ...buyer, [f]: e.target.value })
												}
											/>
										)}
									</label>
								))}
							</div>
							<p>
								Public business information only. Source and website required.
								No inferred personal contact information.
							</p>
							<button disabled={busy}>Save buyer</button>
							<button type="button" onClick={() => setBuyer(null)}>
								Cancel
							</button>
						</form>
					</div>
				)}
				{detail && (
					<div
						className="mi-modal"
						role="dialog"
						aria-modal="true"
						aria-label="Country details"
					>
						<section>
							<h2>{detail.name || "Add country"}</h2>
							{detail.id ? (
								<>
									<p>{detail.note}</p>
									{factors.map((f, i) => (
										<p key={f}>
											{f}: {detail.values[i] ?? "Unknown"} · weight {weights[i]}
											%
										</p>
									))}
									<p>
										Formula: Σ(value × weight) / Σ(available weights). Coverage:{" "}
										{score(detail.values, weights).coverage}%. Scenario date:{" "}
										{detail.updatedAt}. Provenance:{" "}
										{detail.kind === "demo"
											? "synthetic fixture, not collected externally"
											: "user-created country; evidence missing"}
										.
									</p>
									<p>
										Import demand / public price / channel / trade barriers /
										logistics / payment risk: unknown until sourced.
									</p>
								</>
							) : (
								<form
									onSubmit={async (e) => {
										e.preventDefault();
										if (await save({ kind: "market", item: detail }))
											setDetail(null);
									}}
								>
									<input
										required
										placeholder="Country name"
										value={detail.name}
										onChange={(e) =>
											setDetail({ ...detail, name: e.target.value })
										}
									/>
									<input
										required
										placeholder="Local languages"
										value={detail.language}
										onChange={(e) =>
											setDetail({ ...detail, language: e.target.value })
										}
									/>
									<button disabled={busy}>Save country</button>
								</form>
							)}
							<button onClick={() => setDetail(null)}>Close</button>
						</section>
					</div>
				)}
				{record && (
					<div
						className="mi-modal"
						role="dialog"
						aria-label="Source observation"
					>
						<form
							onSubmit={async (e) => {
								e.preventDefault();
								if (await save({ kind: recordKind, item: record }))
									setRecord(null);
							}}
						>
							<h2>Add source-linked {recordKind}</h2>
							<div className="mi-grid">
								{Object.keys(record).map((k) => (
									<label key={k}>
										{k}
										<input
											required={[
												"name",
												"country",
												"sourceUrl",
												"period",
												"value",
												"unit",
												"method",
												"limitations",
											].includes(k)}
											type={
												k === "sourceUrl"
													? "url"
													: k === "period"
														? "date"
														: k === "value"
															? "number"
															: "text"
											}
											value={record[k]}
											onChange={(e) =>
												setRecord({ ...record, [k]: e.target.value })
											}
										/>
									</label>
								))}
							</div>
							<p>
								Only record a public source you checked. Do not enter estimates
								as observed sales.
							</p>
							<button disabled={busy}>Save observation</button>
							<button type="button" onClick={() => setRecord(null)}>
								Cancel
							</button>
						</form>
					</div>
				)}
				<footer>
					BAIHUA SHIJIE EYELASH · Evidence before outreach · No automated
					background collection
				</footer>
			</main>
		</div>
	);
}
