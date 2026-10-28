"use client";
import { useEffect, useState } from "react";
import { defaultWeights, type ScoreWeights } from "@/lib/prospecting/types";
export default function ScoreSettings({ zh }: { zh: boolean }) {
	const [w, setW] = useState<ScoreWeights>(defaultWeights),
		[message, setMessage] = useState("");
	useEffect(() => {
		fetch("/api/prospecting/settings")
			.then((r) => r.json())
			.then((d) => {
				if (d.weights) setW(d.weights);
			})
			.catch(() => setMessage("Settings unavailable"));
	}, []);
	return (
		<section className="prospect-settings">
			<h3>{zh ? "B2B证据评分权重" : "B2B evidence scoring weights"}</h3>
			<p>
				{zh
					? "规则化业务员分流工具，不是采购概率。缺失证据得0分并降低覆盖率；公开索引线索最多获得该项60%，人工核对事实可获得全项。公开WhatsApp格式证据80%，人工核对归属100%，均不代表账号可达。"
					: "Rule-based triage, not purchasing probability. Missing evidence earns zero and lowers coverage. Indexed clues receive 60% of a component; operator-checked facts can receive the full weight. A valid public WhatsApp gives 80% of that component; manual ownership review gives 100%, without proving account availability."}
			</p>
			<div className="prospect-grid">
				{(Object.keys(w) as (keyof ScoreWeights)[]).map((k) => (
					<label key={k}>
						{k}
						<input
							aria-label={`Weight ${k}`}
							type="number"
							min="0"
							max="100"
							value={w[k]}
							onChange={(e) => setW({ ...w, [k]: Number(e.target.value) })}
						/>
					</label>
				))}
			</div>
			<p>
				Total {Object.values(w).reduce((a, b) => a + b, 0)}/100 · A ≥80, B ≥60,
				C ≥40, D &lt;40. No linked company import document = 0 import points.
			</p>
			<button
				onClick={async () => {
					try {
						const r = await fetch("/api/prospecting/settings", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({ weights: w }),
						});
						const d = await r.json();
						setMessage(
							r.ok
								? "Weights saved; reload customer list to recompute"
								: d.error,
						);
					} catch {
						setMessage("Unable to save weights");
					}
				}}
			>
				{zh ? "保存评分权重" : "Save scoring weights"}
			</button>
			{message && <p role="status">{message}</p>}
			<h3>API configuration</h3>
			<p>
				SERPAPI_API_KEY: existing Google, Yandex and Trends access.
				YANDEX_SERPAPI_KEY: optional separate SerpAPI key for the Yandex
				adapter. Account Yandex entitlement must be checked by an actual
				request; no new paid subscription is purchased. YANDEX_API_KEY / direct
				official Yandex Cloud is not selected. UN Comtrade public preview uses
				no key; premium UN_COMTRADE_API_KEY and licensed company-import
				providers are not integrated without an authorized contract.
			</p>
			<p>
				{zh
					? "Windows双击CONFIGURE-API.bat；密钥只放本机.env.local或服务器安全环境变量，保存后重启。应用没有登录/租户隔离，真实客户资料应放在受保护环境。"
					: "Windows: CONFIGURE-API.bat opens local .env.local; keys stay server-side and require restart. No login/tenant isolation exists; protect access before real customer use."}
			</p>
		</section>
	);
}
