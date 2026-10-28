"use client";
import { useState, useEffect } from "react";
import type { Lead } from "@/lib/leads";
import { whatsappIntroduction } from "@/lib/prospecting/client";
import CompanyTrade from "./CompanyTrade";
export default function LeadDossier({
	lead,
	onUpdate,
	onEnrich,
	onMerged,
	leads,
	zh,
	busy,
}: {
	lead: Lead;
	onUpdate: (l: Lead) => void;
	onEnrich: (intent: string, includeWebsite?: boolean) => void;
	onMerged: () => void;
	leads: Lead[];
	zh: boolean;
	busy: boolean;
}) {
	const [current, setCurrent] = useState(lead),
		[reviewer, setReviewer] = useState(""),
		[note, setNote] = useState(""),
		[message, setMessage] = useState(""),
		[official, setOfficial] = useState(false),
		[form, setForm] = useState({
			country: lead.intel?.manual.country ?? "",
			city: lead.intel?.manual.city ?? "",
			companyName: lead.intel?.manual.companyName ?? "",
			officialWebsite: lead.intel?.manual.officialWebsite ?? "",
		}),
		[claim, setClaim] = useState({
			key: "business",
			state: "inference",
			statement: "",
			quote: "",
			sourceUrl: "",
		}),
		[merge, setMerge] = useState(""),
		[mergeReason, setMergeReason] = useState(""),
		[record, setRecord] = useState({
			companyIdentifier: "",
			provider: "",
			sourceUrl: "",
			period: "",
			hsCode: "",
			description: "",
			amount: "",
			currency: "USD",
			quantity: "",
			unit: "",
			scope: "",
		}),
		[match, setMatch] = useState(false);
	const t = (a: string, b: string) => (zh ? b : a);
	useEffect(() => {
		setCurrent(lead);
		setForm({
			country: lead.intel?.manual.country ?? "",
			city: lead.intel?.manual.city ?? "",
			companyName: lead.intel?.manual.companyName ?? "",
			officialWebsite: lead.intel?.manual.officialWebsite ?? "",
		});
		fetch("/api/prospecting/profile?id=" + encodeURIComponent(lead.id))
			.then((r) => (r.ok ? r.json() : null))
			.then((d) => {
				if (d?.lead) setCurrent(d.lead);
			})
			.catch(() =>
				setMessage(t("Detailed history unavailable", "详情历史暂不可用")),
			);
	}, [lead.id, lead.whatsappCheckedAt]);
	const intel = current.intel,
		a = intel?.analysis;
	async function save(action: string, payload: Record<string, unknown>) {
		setMessage("");
		try {
			const r = await fetch("/api/prospecting/profile", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id: lead.id, action, reviewer, ...payload }),
			});
			const d = await r.json();
			if (!r.ok) throw new Error(d.error);
			setCurrent(d.lead);
			onUpdate(d.lead);
			setMessage(
				t(
					"Operator review saved; account availability was not checked",
					"人工核查已保存，未检查WhatsApp账号注册或可达性",
				),
			);
		} catch (e) {
			setMessage(e instanceof Error ? e.message : "Save failed");
		}
	}
	const contacts = intel?.contacts ?? [];
	const sourceSignals = [
		["Eyelash products", /lash|ресниц|rzęs|kirpik/i],
		["DIY Cluster Lashes", /cluster|пучк|kępk/i],
		["Lash Kits", /lash.kit|набор.{0,20}ресниц|zestaw.{0,20}rzęs/i],
		[
			"Private label / own brand",
			/private.label|own.brand|OEM|ODM|собственн.{0,15}бренд|özel.marka/i,
		],
		["Importer", /importer|импорт[её]р|ithalat/i],
		["Wholesale / distribution", /wholesal|distribut|опт|hurtown|toptan/i],
	] as const;
	return (
		<div className="prospect-dossier">
			<h3>{t("Evidence & contact workspace", "客户证据与联系方式工作台")}</h3>
			<p>
				{t(
					"Search titles and target countries are not verified identities or locations. Corporate size, purchase demand and budget remain unknown unless supported by a reviewed public document.",
					"搜索标题和目标国家不是已核实的公司身份或所在地。企业规模、采购需求和预算在有可复核公开证据前保持未知。",
				)}
			</p>
			<div className="prospect-actions">
				{[
					["whatsapp", "Search WhatsApp / 重新查找WhatsApp"],
					["website", "Find company website / 搜索官网"],
					["instagram", "Find Instagram / 搜索Instagram"],
					["telegram", "Find Telegram / 搜索Telegram"],
					["contacts", "More contacts / 更多联系方式"],
				].map(([intent, label]) => (
					<button
						key={intent}
						disabled={busy}
						onClick={() => onEnrich(intent, official && intent === "contacts")}
					>
						{label}
					</button>
				))}
				<a href={current.source} target="_blank" rel="noreferrer">
					Open original source ↗
				</a>
			</div>
			<label className="prospect-check">
				<input
					type="checkbox"
					checked={official}
					onChange={(e) => setOfficial(e.target.checked)}
				/>
				{t(
					"For More contacts: I have confirmed this is the company’s official website and public-page access is permitted. Visit at most 4 pages with robots/access checks. Social platforms remain index-only.",
					"更多联系方式：我已核实这是公司官网，允许访问公开页面；最多4页，遵守robots与访问限制。社交平台仅使用公开索引。",
				)}
			</label>
			<p>
				{t(
					"Each non-cached engine query may consume account quota; Google + Yandex means two queries. No messages are sent.",
					"每个未缓存引擎查询可能消耗额度；双引擎是两次查询。不发送消息。",
				)}
			</p>
			<h4>{t("Public contacts & provenance", "公开联系方式及依据")}</h4>
			<p>
				{t(
					"Format valid means a possible international numbering-plan format, not an issued number, account registration or deliverability.",
					"格式有效仅表示符合可能的国际号码长度与区号规则，不代表已分配号码、已注册账号或可达。",
				)}
			</p>
			{!contacts.length && (
				<p>
					{t(
						"No additional contacts found. Existing legacy fields above are retained; enrich or review public sources.",
						"尚无新增联系方式。上方历史字段保持不变，可补充查询或人工核对。",
					)}
				</p>
			)}
			{contacts.map((c) => (
				<article key={c.id} className="prospect-contact">
					<b>
						{c.kind}: {c.value}
					</b>
					<p>
						{c.kind === "phone"
							? t(
									"Ordinary phone — WhatsApp unconfirmed",
									"普通电话，WhatsApp未确认",
								)
							: c.kind === "whatsapp"
								? t("Number found; ", "已发现号码；")
								: ""}
						{c.format === "valid"
							? t("format valid", "格式有效")
							: t("format unresolved", "格式待核实")}{" "}
						·{" "}
						{c.identity === "manually-confirmed"
							? t("ownership manually confirmed", "归属经人工核对")
							: t("ownership unverified", "归属未确认")}{" "}
						· {t("WhatsApp availability not checked", "未验证WhatsApp可达性")}
					</p>
					<p>
						{c.association} · {c.method} · {c.collectedAt}
					</p>
					<div className="prospect-actions">
						<a href={c.sourceUrl} target="_blank" rel="noreferrer">
							Original public source ↗
						</a>
						{c.directUrl && (
							<a href={c.directUrl} target="_blank" rel="noreferrer">
								{c.kind === "whatsapp" || c.kind === "whatsapp-link"
									? "Open public WhatsApp link"
									: "Open public link"}
							</a>
						)}
					</div>
					{(c.sources?.length ?? 0) > 1 && (
						<details>
							<summary>All contact sources ({c.sources!.length})</summary>
							{c.sources!.map((source, i) => (
								<p key={i}>
									<a href={source.url} target="_blank" rel="noreferrer">
										{source.url}
									</a>{" "}
									· {source.collectedAt} · {source.method}
								</p>
							))}
						</details>
					)}
					{c.reviewedAt && (
						<p>
							{c.reviewer} · {c.reviewedAt} · {c.reviewNote}
						</p>
					)}
					<details>
						<summary>Mark ownership manually reviewed / 标记人工核实</summary>
						<label>
							Reviewer / 核查人
							<input
								value={reviewer}
								onChange={(e) => setReviewer(e.target.value)}
							/>
						</label>
						<label>
							How ownership was checked / 核查方式
							<textarea
								value={note}
								onChange={(e) => setNote(e.target.value)}
								placeholder="Public page and identity matching details; 10+ characters"
							/>
						</label>
						<button
							onClick={() => save("review-contact", { contactId: c.id, note })}
						>
							Save ownership review
						</button>
						<p>This never verifies WhatsApp registration or delivery.</p>
					</details>
				</article>
			))}
			<h4>{t("Company analysis", "客户分析")}</h4>
			<dl className="prospect-facts">
				<dt>Verified country / city</dt>
				<dd>
					{intel?.manual.country || "Unknown"} /{" "}
					{intel?.manual.city || "Unknown"}
				</dd>
				<dt>Target procurement market</dt>
				<dd>
					{current.targetCountry || intel?.targetCountry || "Unknown"} · search
					target only, not proven buying market
				</dd>
				<dt>Size / activity</dt>
				<dd>{a?.companySize ?? "Unknown"}</dd>
				<dt>Possible purchasing needs</dt>
				<dd>{a?.purchaseNeeds ?? "Unknown; ask the company"}</dd>
				<dt>Contact priority / completeness</dt>
				<dd>
					{a?.contactPriority ?? "missing"} · {a?.contactCompleteness ?? 0}/100
					(rule-based triage, not probability)
				</dd>
			</dl>
			{sourceSignals.map(([label, pattern]) => {
				const source = intel?.sources.find(
					(s) =>
						s.engine !== "manual" && pattern.test(s.title + " " + s.snippet),
				);
				return (
					<p key={label}>
						<b>{label}:</b>{" "}
						{source ? (
							<>
								{t(
									"Mentioned in public indexed text — inference, business not confirmed",
									"公开索引提及，仅为推断，业务未证实",
								)}{" "}
								·{" "}
								<a href={source.url} target="_blank" rel="noreferrer">
									Source
								</a>
							</>
						) : (
							t("Unknown", "未知")
						)}
					</p>
				);
			})}
			<details>
				<summary>
					{t(
						"Review company identity & public claims",
						"核实企业身份与公开资料",
					)}
				</summary>
				<label>
					Reviewer
					<input
						value={reviewer}
						onChange={(e) => setReviewer(e.target.value)}
					/>
				</label>
				<div className="prospect-grid">
					{Object.entries(form).map(([k, v]) => (
						<label key={k}>
							{k}
							<input
								type={k === "officialWebsite" ? "url" : "text"}
								value={v}
								onChange={(e) => setForm({ ...form, [k]: e.target.value })}
							/>
						</label>
					))}
				</div>
				<button onClick={() => save("profile", form)}>
					Save manually reviewed identity
				</button>
				<button onClick={() => save("profile", { excludedConsumer: true })}>
					Exclude personal consumer
				</button>
				<h4>Attach public business evidence</h4>
				<div className="prospect-grid">
					<label>
						Category
						<select
							value={claim.key}
							onChange={(e) => setClaim({ ...claim, key: e.target.value })}
						>
							{["product", "business", "oem", "activity"].map((k) => (
								<option key={k}>{k}</option>
							))}
						</select>
					</label>
					<label>
						Status
						<select
							value={claim.state}
							onChange={(e) => setClaim({ ...claim, state: e.target.value })}
						>
							<option value="inference">Inference / 推断</option>
							<option value="fact">Operator-checked fact / 人工核对事实</option>
						</select>
					</label>
					{["statement", "quote", "sourceUrl"].map((k) => (
						<label key={k}>
							{k}
							<input
								value={claim[k as "statement"]}
								onChange={(e) => setClaim({ ...claim, [k]: e.target.value })}
							/>
						</label>
					))}
				</div>
				<p>
					Fact requires exact public quote and reviewer attestation; the app
					does not independently authenticate your assertion.
				</p>
				<button onClick={() => save("add-claim", { claim })}>
					Attach source-backed claim
				</button>
			</details>
			<h4>{t("Transparent B2B score", "透明B2B评分")}</h4>
			<p>
				<b>
					{a?.grade ?? "D"} · {a?.score ?? 0}/100
				</b>{" "}
				· evidence coverage {a?.coverage ?? 0}% · {a?.b2b ?? "unqualified"}
			</p>
			<p>{a?.recommendedReason}</p>
			{a?.components.map((c) => (
				<p key={c.key}>
					{c.key}: {c.earned}/{c.weight} · {c.state} · {c.basis}
				</p>
			))}
			<h4>Facts / 人工核对事实</h4>
			{a?.facts.length ? (
				a.facts.map((c, i) => (
					<p key={i}>
						{c.statement} ·{" "}
						<a href={c.sourceUrl} target="_blank" rel="noreferrer">
							Source
						</a>{" "}
						· {c.reviewer} · {c.collectedAt}
					</p>
				))
			) : (
				<p>No operator-reviewed facts yet.</p>
			)}
			<h4>Inferences / 推断</h4>
			{a?.inferences.map((c, i) => (
				<p key={i}>
					{c.statement} ·{" "}
					<a href={c.sourceUrl} target="_blank" rel="noreferrer">
						Source
					</a>
				</p>
			))}
			<h4>Unknown / 未知</h4>
			{a?.unknowns.map((x) => (
				<p key={x}>{x}</p>
			))}
			<CompanyTrade lead={current} zh={zh} />
			<details>
				<summary>
					{t(
						"Attach company-linked trade document",
						"附加明确关联企业的贸易记录",
					)}
				</summary>
				<p>
					{t(
						"Only add an actual public/licensed company document you reviewed. Never enter a national aggregate, estimated purchasing budget or guessed import amount.",
						"仅录入已核对且明确关联该企业的公开或授权贸易记录。不得录入国家总额、估算采购预算或猜测进口量。",
					)}
				</p>
				<label>
					Reviewer
					<input
						value={reviewer}
						onChange={(e) => setReviewer(e.target.value)}
					/>
				</label>
				<div className="prospect-grid">
					{Object.entries(record).map(([k, v]) => (
						<label key={k}>
							{k}
							<input
								type={
									["amount", "quantity"].includes(k)
										? "number"
										: k === "sourceUrl"
											? "url"
											: "text"
								}
								min="0"
								value={v}
								onChange={(e) => setRecord({ ...record, [k]: e.target.value })}
							/>
						</label>
					))}
				</div>
				<label className="prospect-check">
					<input
						type="checkbox"
						checked={match}
						onChange={(e) => setMatch(e.target.checked)}
					/>
					I checked the company identifier on this actual record; not national
					market totals.
				</label>
				<button
					onClick={() =>
						save("add-import", {
							companyMatchConfirmed: match,
							record: {
								...record,
								amount: record.amount === "" ? null : Number(record.amount),
								quantity:
									record.quantity === "" ? null : Number(record.quantity),
							},
						})
					}
				>
					Attach operator-reviewed record
				</button>
			</details>
			{intel?.manual.corporateImports?.map((r) => (
				<article key={r.id}>
					<b>
						{r.companyIdentifier} · {r.period}
					</b>
					<p>
						{r.amount ?? "Unknown"} {r.currency} · quantity{" "}
						{r.quantity ?? "Unknown"} {r.unit} · HS {r.hsCode} applicability
						pending confirmation
					</p>
					<p>
						{r.description} · {r.scope}
					</p>
					<a href={r.sourceUrl} target="_blank" rel="noreferrer">
						Company-linked document
					</a>
					<p>
						{r.provider} · reviewed by {r.reviewer} · {r.verifiedAt}; not
						independently authenticated by app
					</p>
				</article>
			))}
			<details>
				<summary>
					{t("Proposed first WhatsApp message", "WhatsApp首次联系草稿")}
				</summary>
				<p>
					Suggested language: {a?.recommendedLanguage ?? "en"} · hypothesis
					based on target country, confirm with the company. Send only with
					appropriate permission; no sending functionality.
				</p>
				<textarea
					readOnly
					value={whatsappIntroduction(
						a?.recommendedLanguage ?? "en",
						intel?.manual.companyName || current.name,
					)}
				/>
			</details>
			<details>
				<summary>All sources & history / 全部来源与历史</summary>
				<p>
					All public source links retained; showing the latest 200 audit events
					for this record.
				</p>
				{intel?.sources.map((s, i) => (
					<article key={i}>
						<a href={s.originalUrl || s.url} target="_blank" rel="noreferrer">
							{s.title}
						</a>
						<p>
							{s.engine} · {s.query} · {s.collectedAt}
						</p>
						<p>{s.snippet}</p>
					</article>
				))}
				{intel?.history?.map((h) => (
					<article key={h.id}>
						<b>
							{h.kind} · {h.createdAt}
						</b>
						<pre>{JSON.stringify(h.data, null, 2)}</pre>
					</article>
				))}
			</details>
			<details>
				<summary>
					{t("Merge confirmed same-company records", "合并经确认的同公司记录")}
				</summary>
				<p>
					{t(
						"Sources, contacts, both CRM states and original record are retained. The original becomes an archived alias. This cannot be reversed from this interface.",
						"保留全部来源、联系方式、双方CRM状态及原始记录。原记录成为存档别名，本界面暂不支持撤销。",
					)}
				</p>
				<select
					aria-label="Merge target"
					value={merge}
					onChange={(e) => setMerge(e.target.value)}
				>
					<option value="">Choose target company</option>
					{leads
						.filter((l) => !l.mock && !l.mergedInto && l.id !== lead.id)
						.map((l) => (
							<option key={l.id} value={l.id}>
								{l.name}
							</option>
						))}
				</select>
				<textarea
					value={mergeReason}
					onChange={(e) => setMergeReason(e.target.value)}
					placeholder="Common identity evidence and reason (10+ characters)"
				/>
				<button
					disabled={!merge || mergeReason.trim().length < 10}
					onClick={async () => {
						if (
							!window.confirm(
								t(
									"Merge these reviewed company identities? Both original records will be retained.",
									"确认合并已核实的同公司身份？双方原记录将保留。",
								),
							)
						)
							return;
						const r = await fetch("/api/prospecting/merge", {
							method: "POST",
							headers: { "Content-Type": "application/json" },
							body: JSON.stringify({
								sourceId: lead.id,
								targetId: merge,
								reason: mergeReason,
							}),
						});
						const d = await r.json();
						if (r.ok) onMerged();
						else setMessage(d.error);
					}}
				>
					Merge reviewed identities
				</button>
			</details>
			{message && <p role="status">{message}</p>}
		</div>
	);
}
