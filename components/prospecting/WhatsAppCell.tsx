import type { Lead } from "@/lib/leads";
export default function WhatsAppCell({
	lead: l,
	onFind,
	busy,
	zh,
}: {
	lead: Lead;
	onFind: () => void;
	busy: boolean;
	zh: boolean;
}) {
	const t = (a: string, b: string) => (zh ? b : a);
	const contacts = l.intel?.contacts ?? [];
	const candidate =
		contacts.find(
			(c) => c.kind === "whatsapp" && c.identity === "manually-confirmed",
		) ??
		contacts.find((c) => c.kind === "whatsapp" && c.format === "valid") ??
		contacts.find((c) => c.kind === "whatsapp" || c.kind === "whatsapp-link");
	const value = candidate?.value || (l.whatsapp ? "+" + l.whatsapp : "");
	return (
		<>
			{(l.whatsappLookupStatus === "failed" ||
				l.whatsappLookupStatus === "partial") && (
				<small className="cell-sub" title={l.whatsappLookupError}>
					{t(
						"Last lookup failed/partial; earlier numbers retained",
						"上次查询失败或部分完成，历史号码保留",
					)}{" "}
					· {l.whatsappLookupError?.slice(0, 160)}
				</small>
			)}
			<small className="cell-sub">
				{l.mock
					? t("Demo: no real number", "模拟资料，无真实号码")
					: candidate?.identity === "manually-confirmed"
						? t(
								"Ownership manually checked; account unchecked",
								"人工核对归属，账号未验证",
							)
						: value
							? t("Number pending ownership review", "号码待核实")
							: l.whatsappCheckedAt
								? t("No public number found", "未找到公开号码")
								: t("Not checked yet", "尚未查找")}
			</small>
			{value && (
				<>
					<strong>{value}</strong>
					{candidate?.directUrl && (
						<a href={candidate.directUrl} target="_blank" rel="noreferrer">
							Open WhatsApp ↗
						</a>
					)}
					{(candidate?.sourceUrl || l.whatsappSource) && (
						<a
							href={candidate?.sourceUrl || l.whatsappSource}
							target="_blank"
							rel="noreferrer"
						>
							{t("View source", "查看来源")}
						</a>
					)}
					<small className="cell-sub">
						{candidate?.format === "unresolved"
							? t("Format unresolved", "格式待核实")
							: t("Account availability not checked", "账号可达性未检查")}
					</small>
				</>
			)}
			{!value && contacts.some((c) => c.kind === "phone") && (
				<small className="cell-sub">
					{t(
						"Ordinary phone found; WhatsApp unconfirmed",
						"仅找到普通电话，WhatsApp未确认",
					)}
				</small>
			)}
			{!l.mock && (
				<button className="whatsapp-find" disabled={busy} onClick={onFind}>
					{t("Find WhatsApp", "查找 WhatsApp")}
				</button>
			)}
		</>
	);
}
