import { createHash } from "node:crypto";
export function safeURL(value: string) {
	try {
		const u = new URL(value);
		if (
			!["http:", "https:"].includes(u.protocol) ||
			u.username ||
			u.password ||
			!u.hostname.includes(".")
		)
			return null;
		u.hash = "";
		for (const k of [...u.searchParams.keys()])
			if (/^(utm_|gclid|fbclid|srsltid|yclid)/i.test(k))
				u.searchParams.delete(k);
		return u;
	} catch {
		return null;
	}
}
export function platformOf(value: string) {
	const h =
		safeURL(value)
			?.hostname.replace(/^www\./, "")
			.toLowerCase() ?? "";
	if (h === "instagram.com" || h.endsWith(".instagram.com")) return "instagram";
	if (["t.me", "telegram.me"].includes(h)) return "telegram";
	if (h === "facebook.com" || h.endsWith(".facebook.com") || h === "fb.com")
		return "facebook";
	return "web";
}
export function canonicalCompany(value: string) {
	const u = safeURL(value);
	if (!u) return "";
	const host = u.hostname.replace(/^www\./, "").toLowerCase();
	const platform = platformOf(u.href);
	if (platform !== "web") {
		const parts = u.pathname.split("/").filter(Boolean);
		if (!parts.length) return platform + ":unresolved:" + u.href;
		const path =
			platform === "facebook" &&
			["groups", "pages", "profile.php"].includes(parts[0])
				? parts.slice(0, 2).join("/") + (u.searchParams.get("id") ?? "")
				: parts[0];
		if (["p", "reel", "reels", "stories", "share", "s"].includes(path))
			return platform + ":post:" + u.href;
		return platform + ":" + path.toLowerCase();
	}
	return "domain:" + host;
}
export function stableID(value: string, prefix = "prospect-") {
	return prefix + createHash("sha256").update(value).digest("hex").slice(0, 24);
}
export function sameOwner(source: string, website: string) {
	const a = safeURL(source),
		b = safeURL(website);
	if (!a || !b) return false;
	if (platformOf(b.href) !== "web")
		return canonicalCompany(a.href) === canonicalCompany(b.href);
	return (
		a.hostname.replace(/^www\./, "").toLowerCase() ===
		b.hostname.replace(/^www\./, "").toLowerCase()
	);
}
export function contactKey(kind: string, value: string) {
	return stableID(kind + ":" + value.toLowerCase(), "contact-");
}

export function researchResource(url: string, title: string) {
	const u = safeURL(url);
	if (!u) return true;
	return (
		/\b(?:top|best)\s+\d+|\b(?:business|supplier|importer)\s+director|exhibitor\s+list|list of.{0,30}(?:suppliers|companies)|companies in/i.test(
			title,
		) ||
		/\/(?:directory|exhibitors|groups|joinchat)(?:\/|$)|\/companies\//i.test(
			u.pathname,
		) ||
		(platformOf(u.href) === "telegram" && u.pathname.startsWith("/+"))
	);
}
