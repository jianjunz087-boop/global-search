"use client";
import { useState } from "react";
import { products } from "@/lib/intelligence/model";
import {
	liveCountries,
	tradeWarning,
	type SourceState,
	type TradeContext,
} from "@/lib/intelligence/live-model";
export default function LiveSources({
	sources,
	trades,
	onCollected,
	cn,
}: {
	sources: SourceState[];
	trades: TradeContext[];
	onCollected: () => Promise<void>;
	cn: boolean;
}) {
	const [source, setSource] = useState("google-trends"),
		[country, setCountry] = useState("United States"),
		[product, setProduct] = useState(products[0]),
		[keyword, setKeyword] = useState(""),
		[range, setRange] = useState("today 12-m"),
		[year, setYear] = useState(new Date().getFullYear() - 1),
		[hsCode, setHS] = useState("670419"),
		[busy, setBusy] = useState(false),
		[error, setError] = useState(""),
		[result, setResult] = useState("");
	const provider = sources.find((s) => s.id === source);
	async function collect() {
		setBusy(true);
		setError("");
		setResult("");
		try {
			const response = await fetch("/api/intelligence/collect", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					source,
					country,
					product,
					keyword: keyword.trim() || product,
					range,
					year,
					hsCode,
				}),
			});
			const d = await response.json();
			if (!response.ok) {
				const translations: Record<string, string> = {
					MISSING_API_KEY: "未配置密钥，请运行 CONFIGURE-API.bat 后重启项目",
					INVALID_API_KEY: "密钥无效，请检查并重启项目",
					ACCESS_DENIED: "服务或网络拒绝访问，请检查密钥和网络",
					QUOTA_EXCEEDED: "账号额度不足或请求过快，请检查 SerpAPI 账户",
					TIMEOUT: "接口超时，本次没有写入数据",
					NETWORK_ERROR: "无法连接数据源，请检查网络或代理",
					RATE_LIMIT: "请等待60秒后再执行新查询",
					PROVIDER_ERROR: "数据服务返回错误，关键词可能没有足够数据",
					INVALID_RESPONSE: "数据格式不符合预期，本次没有写入数据",
				};
				throw new Error(
					`${d.code}: ${cn ? (translations[d.code] ?? d.error) : d.error}`,
				);
			}
			setResult(
				`${d.cached ? (cn ? "使用15分钟缓存" : "15-minute cache") : cn ? "已完成API请求" : "API request completed"} · ${d.received} ${cn ? "条记录，跳过" : "records, skipped"} ${d.skipped} · ${d.collectedAt}. ${d.message}`,
			);
			await onCollected();
		} catch (e) {
			setError(e instanceof Error ? e.message : "Collection failed");
			await onCollected().catch(() => {});
		} finally {
			setBusy(false);
		}
	}
	return (
		<>
			<section>
				<h2>{cn ? "真实数据采集" : "Live data collection"}</h2>
				<p>
					{cn
						? "仅点击采集时调用API。SerpAPI 查询可能消耗账号额度；相同查询缓存15分钟，新查询每数据源至少间隔60秒。没有后台自动采集。"
						: "Manual collection only. SerpAPI calls may consume account quota. Identical queries reuse a 15-minute cache; new queries are limited to one per source per 60 seconds. No background collection."}
				</p>
				<form
					onSubmit={(e) => {
						e.preventDefault();
						void collect();
					}}
				>
					<div className="mi-filters">
						<label>
							{cn ? "数据源" : "Source"}
							<select
								value={source}
								onChange={(e) => setSource(e.target.value)}
							>
								<option value="google-trends">Google Trends / SerpAPI</option>
								<option value="comtrade">
									UN Comtrade · broad trade context
								</option>
							</select>
						</label>
						<label>
							{cn ? "国家" : "Country"}
							<select
								value={country}
								onChange={(e) => setCountry(e.target.value)}
							>
								{liveCountries.map((c) => (
									<option key={c.geo}>{c.name}</option>
								))}
							</select>
						</label>
						{source === "google-trends" ? (
							<>
								<label>
									{cn ? "产品" : "Product"}
									<select
										value={product}
										onChange={(e) => setProduct(e.target.value)}
									>
										{products.map((p) => (
											<option key={p}>{p}</option>
										))}
									</select>
								</label>
								<label>
									{cn ? "搜索词（可选）" : "Search term (optional)"}
									<input
										maxLength={100}
										placeholder={product}
										value={keyword}
										onChange={(e) => setKeyword(e.target.value)}
									/>
								</label>
								<label>
									{cn ? "时间范围" : "Date range"}
									<select
										value={range}
										onChange={(e) => setRange(e.target.value)}
									>
										<option value="today 3-m">3 months</option>
										<option value="today 12-m">12 months</option>
										<option value="today 5-y">5 years</option>
									</select>
								</label>
							</>
						) : (
							<>
								<label>
									{cn ? "年份" : "Year"}
									<input
										type="number"
										min={2015}
										max={new Date().getFullYear() - 1}
										value={year}
										onChange={(e) => setYear(Number(e.target.value))}
									/>
								</label>
								<label>
									HS category
									<select
										value={hsCode}
										onChange={(e) => setHS(e.target.value)}
									>
										<option value="670419">
											670419 · other synthetic hair articles
										</option>
										<option value="670420">670420 · human-hair articles</option>
										<option value="670490">
											670490 · other-material hair articles
										</option>
									</select>
								</label>
							</>
						)}
					</div>
					<button disabled={busy || !provider?.configured}>
						{busy
							? cn
								? "正在查询…"
								: "Querying…"
							: cn
								? "采集真实数据"
								: "Collect real data"}
					</button>
				</form>
				{!provider?.configured && (
					<p role="status">
						{cn
							? "未配置密钥：在电脑项目文件夹双击 CONFIGURE-API.bat，填写 SERPAPI_API_KEY，保存后关闭并重新打开 START-WINDOWS.bat。不要把密钥发送到聊天。"
							: "Missing key: double-click CONFIGURE-API.bat on your computer, set SERPAPI_API_KEY, save, then close and restart START-WINDOWS.bat. Never send keys in chat."}
					</p>
				)}
				{error && (
					<p role="alert" className="mi-error">
						{error}
					</p>
				)}
				{result && <p role="status">{result}</p>}
				<p>
					{source === "google-trends"
						? cn
							? "Google Trends 是相对搜索热度指数，不是销量；不同国家、关键词或时间范围独立归一化，不能直接作为国家需求排名。"
							: "Google Trends measures relative search interest, not sales. Separate country, keyword and date-window queries cannot establish a demand ranking."
						: cn
							? "这些HS编码还包含假发、胡须等其他毛发制品，数据仅作贸易背景，不能认定为假睫毛进口额。"
							: "These HS categories include wigs and other hair articles. Values provide trade context and are not eyelash-specific import amounts."}
				</p>
			</section>
			<section>
				<h2>
					{cn
						? "API 配置与采集状态"
						: "Source transparency & API configuration"}
				</h2>
				{sources.map((s) => (
					<article key={s.id}>
						<div className="mi-section">
							<h3>{s.name}</h3>
							<em>
								{s.configured
									? s.credentialRequired
										? "Key present · " + s.status
										: s.status
									: "Not configured"}
							</em>
						</div>
						<a href={s.url} target="_blank" rel="noreferrer">
							{s.url}
						</a>
						<p>
							{s.method} · Period: {s.range}
						</p>
						<p>
							Last attempt: {s.lastAttemptAt ?? "Never"} · Last successful
							request: {s.lastSuccessAt ?? "Never"} · Last stored data:{" "}
							{s.lastCollected ?? "Never"}
						</p>
						{s.lastError && <p role="alert">{s.lastError}</p>}
						<p>{s.restriction}</p>
					</article>
				))}
				<p>
					{cn
						? "密钥只在服务端使用。存在密钥不代表认证成功，必须完成一次真实请求。搜索客户请进入左下角 Existing discovery CRM。"
						: "Keys are server-only. Presence does not prove provider authentication; a successful real request is required. Use Existing discovery CRM for real customer discovery."}
				</p>
			</section>
			<section>
				<h2>
					{cn
						? "官方贸易背景（非假睫毛专属）"
						: "Official broad-category trade context"}
				</h2>
				<p>{tradeWarning}</p>
				{!trades.length ? (
					<div className="mi-empty">
						{cn
							? "尚无已采集的官方贸易记录。网络错误或无数据不会被填成零。"
							: "No official trade records collected. Network failures and absent data remain unknown."}
					</div>
				) : (
					<div className="mi-table">
						<table>
							<thead>
								<tr>
									<th>Country / period</th>
									<th>HS / revision</th>
									<th>Broad-category imports · USD</th>
									<th>Scope & source</th>
								</tr>
							</thead>
							<tbody>
								{trades.map((t) => (
									<tr key={t.id}>
										<td>
											{t.country}
											<small>{t.year}</small>
										</td>
										<td>
											{t.hsCode}
											<small>{t.classification}</small>
										</td>
										<td>
											{new Intl.NumberFormat("en-US", {
												style: "currency",
												currency: "USD",
											}).format(t.value)}
											<small>
												Reported:{" "}
												{t.isReported === null
													? "Unknown"
													: String(t.isReported)}
											</small>
										</td>
										<td style={{ whiteSpace: "normal", minWidth: 220 }}>
											{t.description}
											<small>{t.method}</small>
											<a href={t.sourceUrl} target="_blank" rel="noreferrer">
												UN Comtrade source ↗
											</a>
											<small>{t.collectedAt}</small>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				)}
			</section>
		</>
	);
}
