"use client";
import { useState, useEffect } from "react";
import type { DiscoveryQuery, SearchTask } from "@/lib/prospecting/types";
import { suggestedQueries } from "@/lib/prospecting/queries";
import { emptyFilters, type ProspectFilters } from "@/lib/prospecting/client";
import { parseCSV, csv } from "@/lib/intelligence/model";
export type DiscoveryConfig = Pick<
	DiscoveryQuery,
	| "engine"
	| "language"
	| "region"
	| "limit"
	| "timeoutMs"
	| "platform"
	| "product"
>;
export const defaultConfig: DiscoveryConfig = {
	engine: "google",
	language: "auto",
	region: "",
	limit: 10,
	timeoutMs: 30000,
	platform: "web",
	product: "",
};
export default function DiscoveryControls({
	config,
	setConfig,
	filters,
	setFilters,
	country,
	keyword,
	type,
	onKeyword,
	onRestore,
	onRefresh,
	ids,
	zh,
}: {
	config: DiscoveryConfig;
	setConfig: (v: DiscoveryConfig) => void;
	filters: ProspectFilters;
	setFilters: (v: ProspectFilters) => void;
	country: string;
	keyword: string;
	type: string;
	onKeyword: (v: string) => void;
	onRestore: (q: DiscoveryQuery, f?: Record<string, string>) => void;
	onRefresh: () => void;
	ids: string[];
	zh: boolean;
}) {
	const [tasks, setTasks] = useState<SearchTask[]>([]),
		[info, setInfo] = useState(""),
		[usage, setUsage] = useState(""),
		[open, setOpen] = useState(false),
		[statuses, setStatuses] = useState<{ id: string; configured: boolean }[]>(
			[],
		);
	const t = (a: string, b: string) => (zh ? b : a);
	async function refresh() {
		try {
			const r = await fetch("/api/prospecting/tasks"),
				d = await r.json();
			if (r.ok) {
				setTasks(d.tasks);
				setUsage(
					`${d.usage.requestsAttempted} API requests attempted / last 50 tasks. Account billing/quota unknown.`,
				);
			}
		} catch {
			setInfo(t("Task service unavailable", "任务服务暂不可用"));
		}
	}
	useEffect(() => {
		fetch("/api/prospecting/settings")
			.then((r) => r.json())
			.then((d) => setStatuses(d.engines ?? []))
			.catch(() => {});
	}, []);
	useEffect(() => {
		if (!open) return;
		void refresh();
		const timer = setInterval(refresh, 4000);
		return () => clearInterval(timer);
	}, [open]);
	async function exportFile(format: string) {
		if (!ids.length) {
			setInfo(t("No matching records to export", "没有匹配的记录"));
			return;
		}
		const r = await fetch(
			"/api/prospecting/export?format=" +
				format +
				"&ids=" +
				ids.map(encodeURIComponent).join(","),
		);
		if (!r.ok) {
			setInfo("Export failed");
			return;
		}
		const u = URL.createObjectURL(await r.blob()),
			a = document.createElement("a");
		a.href = u;
		a.download = `BAIHUA-B2B-evidence.${format}`;
		a.click();
		setTimeout(() => URL.revokeObjectURL(u), 1000);
	}
	async function importFile(file: File) {
		try {
			if (file.size > 5 * 1024 * 1024)
				throw new Error("Maximum file size 5 MB");
			let rows: string[][] = [];
			if (file.name.toLowerCase().endsWith(".xlsx")) {
				const { default: ExcelJS } = await import("exceljs");
				const wb = new ExcelJS.Workbook();
				await wb.xlsx.load(await file.arrayBuffer());
				wb.worksheets[0].eachRow((r) =>
					rows.push(
						Array.from(
							{ length: r.cellCount },
							(_, i) => r.getCell(i + 1).text,
						),
					),
				);
			} else rows = parseCSV(await file.text());
			const headers =
				rows.shift()?.map((x) => x.replace(/^\uFEFF/, "").trim()) ?? [];
			const response = await fetch("/api/prospecting/import", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					rows: rows.map((r) =>
						Object.fromEntries(headers.map((h, i) => [h, r[i] ?? ""])),
					),
				}),
			});
			const d = await response.json();
			if (!response.ok) throw new Error(d.error);
			setInfo(
				`Imported ${d.added}; domain duplicates ${d.duplicates}. Existing CRM notes retained.`,
			);
			onRefresh();
		} catch (e) {
			setInfo(e instanceof Error ? e.message : "Import failed");
		}
	}
	return (
		<div className="prospect-controls">
			<details open>
				<summary>
					{t(
						"Search engines & public-source discovery",
						"搜索引擎与公开来源发现",
					)}
				</summary>
				<div className="prospect-grid">
					<label>
						{t("Search engine", "搜索引擎")}
						<select
							aria-label="Search engine"
							value={config.engine}
							onChange={(e) =>
								setConfig({
									...config,
									engine: e.target.value as DiscoveryConfig["engine"],
								})
							}
						>
							<option value="google">Google / SerpAPI</option>
							<option value="yandex">Yandex / SerpAPI</option>
							<option value="both">Google + Yandex (parallel)</option>
						</select>
					</label>
					<label>
						{t("Language", "查询语言")}
						<select
							aria-label="Search language"
							value={config.language}
							onChange={(e) =>
								setConfig({ ...config, language: e.target.value })
							}
						>
							{["auto", "en", "ru", "pl", "tr", "de", "fr", "es"].map((x) => (
								<option key={x}>{x}</option>
							))}
						</select>
					</label>
					<label>
						{t("Public platform", "公开平台")}
						<select
							aria-label="Public platform"
							value={config.platform}
							onChange={(e) =>
								setConfig({
									...config,
									platform: e.target.value as DiscoveryConfig["platform"],
								})
							}
						>
							{["web", "instagram", "telegram", "facebook", "directories"].map(
								(x) => (
									<option key={x}>{x}</option>
								),
							)}
						</select>
					</label>
					<label>
						{t("Product focus", "目标产品")}
						<select
							aria-label="Discovery product"
							value={config.product}
							onChange={(e) =>
								setConfig({ ...config, product: e.target.value })
							}
						>
							{[
								"",
								"DIY Cluster Lashes",
								"YY Lashes",
								"Dense Cluster Lashes",
								"Strip Lashes",
								"Eyelash Extension",
								"Premade Fans",
								"DIY Lash Kits",
								"Lash Glue",
								"Bond & Seal",
								"Remover",
								"Tweezers",
								"Brushes",
							].map((x) => (
								<option key={x} value={x}>
									{x || "Any eyelash product"}
								</option>
							))}
						</select>
					</label>
					<label>
						{t("Yandex region ID (optional)", "Yandex 地区ID（可选）")}
						<input
							aria-label="Yandex region"
							inputMode="numeric"
							value={config.region}
							onChange={(e) => setConfig({ ...config, region: e.target.value })}
							placeholder="e.g. 225"
						/>
					</label>
					<label>
						{t("Max results per engine", "每引擎返回上限")}
						<select
							aria-label="Results per engine"
							value={config.limit}
							onChange={(e) =>
								setConfig({ ...config, limit: Number(e.target.value) })
							}
						>
							{[5, 10, 20].map((x) => (
								<option key={x}>{x}</option>
							))}
						</select>
					</label>
					<label>
						{t("Timeout (seconds)", "超时（秒）")}
						<select
							aria-label="Search timeout"
							value={config.timeoutMs}
							onChange={(e) =>
								setConfig({ ...config, timeoutMs: Number(e.target.value) })
							}
						>
							{[10000, 20000, 30000, 45000].map((x) => (
								<option key={x} value={x}>
									{x / 1000}
								</option>
							))}
						</select>
					</label>
				</div>
				<p>
					{statuses
						.map(
							(s) =>
								`${s.id}: ${s.configured ? t("key present, account access unverified", "密钥存在，账号权限待查询验证") : t("not configured", "未配置")}`,
						)
						.join(" · ")}
					.{" "}
					{t(
						"Both engines can use up to 2 provider calls per page, plus at most one retry per engine on HTTP 5xx. Yandex uses the existing SerpAPI key unless YANDEX_SERPAPI_KEY is configured. Returned count is an upper bound; providers may return fewer results.",
						"双引擎每页可能消耗2次查询，每个引擎遇到HTTP 5xx最多重试一次。优先复用SerpAPI密钥；返回数是上限，不保证每次满足。",
					)}
				</p>
				<div className="prospect-actions">
					{suggestedQueries(country).map((s) => (
						<button key={s} type="button" onClick={() => onKeyword(s)}>
							{s}
						</button>
					))}
				</div>
				<div className="prospect-actions">
					<button
						onClick={async () => {
							const r = await fetch("/api/prospecting/settings", {
								method: "POST",
								headers: { "Content-Type": "application/json" },
								body: JSON.stringify({
									action: "save-setup",
									query: { ...config, keyword, country, type, page: 1 },
									filters,
								}),
							});
							setInfo(
								r.ok
									? t("Search setup saved", "搜索条件已保存")
									: "Save failed",
							);
						}}
					>
						{t("Save search setup", "保存搜索条件")}
					</button>
					<button
						onClick={async () => {
							const r = await fetch("/api/prospecting/settings");
							const d = await r.json();
							if (d.savedSetup)
								onRestore(d.savedSetup.query, d.savedSetup.filters);
							else setInfo(t("No saved setup yet", "暂无已保存条件"));
						}}
					>
						{t("Restore saved setup", "恢复搜索条件")}
					</button>
				</div>
			</details>
			<details>
				<summary>
					{t("B2B evidence filters & import/export", "B2B证据筛选与导入导出")}
				</summary>
				<div className="prospect-grid">
					<label>
						{t("Verified city", "已核实城市")}
						<input
							aria-label="Verified city filter"
							value={filters.city}
							onChange={(e) => setFilters({ ...filters, city: e.target.value })}
						/>
					</label>
					{(
						[
							["grade", ["", "A", "B", "C", "D"], "Rating / 客户评级"],
							[
								"confidence",
								["", "25", "50", "75", "100"],
								"Evidence coverage ≥ / 证据覆盖率",
							],
							[
								"whatsapp",
								["", "found", "missing", "verified", "phone"],
								"WhatsApp status / 状态",
							],
							["instagram", ["", "yes", "no"], "Instagram"],
							["telegram", ["", "yes", "no"], "Telegram"],
							[
								"website",
								["", "yes", "no"],
								"Manually confirmed website / 人工核实官网",
							],
							[
								"imports",
								["", "yes", "no"],
								"Company-linked import evidence / 企业进口记录",
							],
							[
								"b2b",
								["exclude-consumers", "signals", "all"],
								"B2B review / 业务核查",
							],
						] as const
					).map(([key, values, label]) => (
						<label key={key}>
							{label}
							<select
								aria-label={label}
								value={filters[key]}
								onChange={(e) =>
									setFilters({ ...filters, [key]: e.target.value })
								}
							>
								{values.map((v) => (
									<option key={v} value={v}>
										{v || "All / 全部"}
									</option>
								))}
							</select>
						</label>
					))}
				</div>
				<p>
					{t(
						'Coverage is evidence availability, not probability. "verified" means operator-confirmed ownership, never WhatsApp registration or deliverability. Ordinary phones remain WhatsApp-unconfirmed.',
						"覆盖率是证据可用度，不是概率；verified只表示人工核对归属，不代表已验证WhatsApp注册或可达性。普通电话仍为WhatsApp未确认。",
					)}
				</p>
				<div className="prospect-actions">
					<button onClick={() => setFilters({ ...emptyFilters })}>
						{t("Reset evidence filters", "重置证据筛选")}
					</button>
					<button onClick={() => exportFile("csv")}>CSV + evidence</button>
					<button onClick={() => exportFile("xlsx")}>Excel + evidence</button>
					<label className="prospect-upload">
						Import CSV / XLSX
						<input
							aria-label="Import discovery leads"
							type="file"
							accept=".csv,.xlsx"
							onChange={(e) => {
								const file = e.target.files?.[0];
								if (file) void importFile(file);
								e.target.value = "";
							}}
						/>
					</label>
					<button
						onClick={() => {
							const url = URL.createObjectURL(
								new Blob(
									[
										csv([
											[
												"name",
												"website",
												"source",
												"type",
												"country",
												"email",
												"whatsapp",
												"note",
											],
										]),
									],
									{ type: "text/csv" },
								),
							);
							const a = document.createElement("a");
							a.href = url;
							a.download = "B2B-import-template.csv";
							a.click();
							setTimeout(() => URL.revokeObjectURL(url), 1000);
						}}
					>
						Import template
					</button>
				</div>
			</details>
			<details onToggle={(e) => setOpen(e.currentTarget.open)}>
				<summary>
					{t("Search tasks, errors & API usage", "搜索任务、错误与API调用")}
				</summary>
				<p>
					{t(
						"Persistent app-local queue. Runs while the application server is active; this is not a deployed external scheduler. Same queries cache for 15 minutes. Never retry a paid request blindly.",
						"持久化应用内队列，需要应用服务运行；不是外部定时任务服务。相同查询缓存15分钟。请勿盲目重复付费查询。",
					)}{" "}
					{usage}
				</p>
				{tasks.length === 0 ? (
					<p>No saved tasks / 暂无任务</p>
				) : (
					tasks.map((task) => (
						<article className="prospect-task" key={task.id}>
							<b>
								{task.state} · {task.query.engine} ·{" "}
								{task.query.country || "Global"} ·{" "}
								{task.query.keyword || "eyelashes"}
							</b>
							<p>
								{task.createdAt} · API attempts {task.usage} · cache{" "}
								{task.cacheHit ? "yes" : "no"}
							</p>
							{Array.isArray(task.result?.resources) &&
								(task.result!.resources as any[]).map((source, i) => (
									<p key={i}>
										Research resource (not a company):{" "}
										<a href={source.url} target="_blank" rel="noreferrer">
											{source.title}
										</a>{" "}
										· {source.engine} · {source.collectedAt}
									</p>
								))}
							{task.errors.map((e, i) => (
								<p role="alert" key={i}>
									{e.engine}: {e.code} · {e.message}
								</p>
							))}
							<div className="prospect-actions">
								<button onClick={() => onRestore(task.query, task.savedFilter)}>
									{t("Restore query & filters", "恢复查询和筛选")}
								</button>
								<button
									onClick={async () => {
										const r = await fetch("/api/prospecting/tasks", {
											method: "POST",
											headers: { "Content-Type": "application/json" },
											body: JSON.stringify({ action: "retry", id: task.id }),
										});
										setInfo(
											r.ok
												? t(
														"Retry queued; cached successes reused",
														"已加入重试队列，优先复用缓存",
													)
												: "Retry failed",
										);
										void refresh();
									}}
								>
									{t("Retry (may use quota)", "重试（可能消耗额度）")}
								</button>
								<button
									disabled={
										!task.results?.length ||
										!["succeeded", "partial"].includes(task.state)
									}
									onClick={async () => {
										const r = await fetch(
											"/api/prospecting/tasks?id=" +
												encodeURIComponent(task.id),
										);
										if (!r.ok) {
											setInfo("Unable to export saved request");
											return;
										}
										const d = await r.json();
										const url = URL.createObjectURL(
											new Blob([JSON.stringify(d, null, 2)], {
												type: "application/json",
											}),
										);
										const a = document.createElement("a");
										a.href = url;
										a.download = "BAIHUA-search-task-" + task.id + ".json";
										a.click();
										setTimeout(() => URL.revokeObjectURL(url), 1000);
									}}
								>
									Export stored search example
								</button>
								{task.state === "queued" && (
									<button
										onClick={async () => {
											await fetch("/api/prospecting/tasks", {
												method: "POST",
												headers: { "Content-Type": "application/json" },
												body: JSON.stringify({ action: "cancel", id: task.id }),
											});
											void refresh();
										}}
									>
										Cancel queued
									</button>
								)}
							</div>
						</article>
					))
				)}
			</details>
			{info && <p role="status">{info}</p>}
		</div>
	);
}
