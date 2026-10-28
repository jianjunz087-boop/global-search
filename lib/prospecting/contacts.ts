import { load } from "cheerio";
import {
	parsePhoneNumberFromString,
	type CountryCode,
} from "libphonenumber-js";
import {
	contactKey,
	stableID,
	safeURL,
	sameOwner,
	platformOf,
} from "./identity";
import type { ContactEvidence, SourceEvidence } from "./types";
export function normalizePhone(raw: string, verifiedCountry?: CountryCode) {
	const cleaned = raw.trim().replace(/^00/, "+");
	if (!cleaned.startsWith("+") && !verifiedCountry) return null;
	try {
		const p = parsePhoneNumberFromString(cleaned, verifiedCountry);
		if (!p || !p.isPossible()) return null;
		return {
			number: p.number,
			digits: p.number.replace(/\D/g, ""),
			country: p.country,
			extension: p.ext,
		};
	} catch {
		return null;
	}
}
export function extractPublicContacts(input: {
	text: string;
	links?: string[];
	sourceUrl: string;
	website: string;
	method: string;
	collectedAt?: string;
	verifiedCountry?: CountryCode;
	engine?: ContactEvidence["engine"];
	query?: string;
}) {
	const time = input.collectedAt ?? new Date().toISOString(),
		contacts: ContactEvidence[] = [];
	const association = sameOwner(input.sourceUrl, input.website)
		? platformOf(input.website) === "web"
			? "same-website"
			: "same-account"
		: "related-unverified";
	const add = (
		kind: ContactEvidence["kind"],
		value: string,
		raw: string,
		valid = true,
		directUrl?: string,
	) => {
		if (!value) return;
		const id = contactKey(kind, value + ":" + input.sourceUrl);
		if (contacts.some((c) => c.id === id)) return;
		contacts.push({
			id,
			kind,
			value,
			raw,
			sourceUrl: input.sourceUrl,
			collectedAt: time,
			method: input.method,
			association,
			format: valid ? "valid" : "unresolved",
			identity: "unverified",
			availability: "not-checked",
			...(directUrl ? { directUrl } : {}),
			engine: input.engine,
			query: input.query,
		});
	};
	const urls = [
		...(input.links ?? []),
		...Array.from(
			input.text.matchAll(
				/(?:https?:\/\/|www\.|(?:wa\.me|api\.whatsapp\.com|t\.me|instagram\.com)\/)[^\s<>"']+/gi,
			),
			(m) => m[0].replace(/[),.;]+$/, ""),
		),
	];
	for (const raw of urls) {
		let value = raw;
		try {
			value = new URL(raw, input.sourceUrl).href;
		} catch {
			continue;
		}
		const u = safeURL(value);
		if (!u) continue;
		const host = u.hostname.toLowerCase().replace(/^www\./, "");
		let wa: string | null = null;
		if (host === "wa.me" && /^\/\+?\d+$/.test(u.pathname))
			wa = u.pathname.slice(1);
		if (
			["api.whatsapp.com", "web.whatsapp.com"].includes(host) &&
			u.pathname.startsWith("/send")
		)
			wa = u.searchParams.get("phone");
		if (wa) {
			const p = normalizePhone("+" + wa.replace(/\D/g, ""));
			add(
				"whatsapp",
				p?.number ?? wa,
				raw,
				!!p,
				p && association !== "related-unverified"
					? `https://wa.me/${p.digits}`
					: undefined,
			);
			continue;
		}
		if (host === "wa.me" && /^\/message\/[A-Za-z0-9]+\/?$/.test(u.pathname)) {
			add(
				"whatsapp-link",
				u.href,
				raw,
				true,
				association !== "related-unverified" ? u.href : undefined,
			);
			continue;
		}
		const platform = platformOf(u.href);
		const segment = u.pathname.split("/").filter(Boolean)[0];
		if (
			platform !== "web" &&
			segment &&
			!["p", "reel", "reels", "stories", "share", "s", "sharer.php"].includes(
				segment,
			)
		) {
			add(platform, u.href, raw, true, u.href);
			continue;
		}
		if (
			platform === "web" &&
			![
				"wa.me",
				"whatsapp.com",
				"api.whatsapp.com",
				"web.whatsapp.com",
			].includes(host)
		)
			add("website", u.href, raw, true, u.href);
	}
	for (const m of input.text.matchAll(
		/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
	))
		add("email", m[0].toLowerCase(), m[0]);
	// A WhatsApp label is required. Ordinary telephone numbers are never upgraded to WhatsApp.
	for (const m of input.text.matchAll(
		/whats\s*app\s*(?:business\s*)?[:：–-]?\s*(\+?\d[\d\s().-]{5,25}\d)/gi,
	)) {
		const p = normalizePhone(m[1], input.verifiedCountry);
		add(
			"whatsapp",
			p?.number ?? m[1].trim(),
			m[0],
			!!p,
			p && association !== "related-unverified"
				? `https://wa.me/${p.digits}`
				: undefined,
		);
	}
	for (const m of input.text.matchAll(
		/(?:phone|telephone|tel|телефон|тел\.|telefon|телефоны)\s*[:：–-]?\s*(\+?\d[\d\s().-]{5,25}\d)/gi,
	)) {
		const p = normalizePhone(m[1], input.verifiedCountry);
		add("phone", p?.number ?? m[1].trim(), m[0], !!p);
	}
	for (const raw of input.links ?? []) {
		if (/^mailto:/i.test(raw)) {
			const email = raw.slice(7).split("?")[0];
			if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
				add("email", email.toLowerCase(), raw);
		}
		if (/^tel:/i.test(raw)) {
			let rawPhone = raw.slice(4);
			try {
				rawPhone = decodeURIComponent(rawPhone);
			} catch {}
			const p = normalizePhone(rawPhone, input.verifiedCountry);
			add("phone", p?.number ?? rawPhone, raw, !!p);
		}
	}

	for (const m of input.text.matchAll(
		/(?:instagram|инстаграм)\s*[:：–-]?\s*@([A-Za-z0-9._]{1,30})/gi,
	)) {
		const url = "https://www.instagram.com/" + m[1] + "/";
		add("instagram", url, m[0], true, url);
	}
	for (const m of input.text.matchAll(
		/(?:telegram|телеграмм?)\s*[:：–-]?\s*@([A-Za-z0-9_]{5,32})/gi,
	)) {
		const url = "https://t.me/" + m[1];
		add("telegram", url, m[0], true, url);
	}
	for (const m of input.text.matchAll(/\+\d[\d ().-]{5,25}\d/g)) {
		const p = normalizePhone(m[0]);
		if (
			p &&
			!contacts.some((c) => c.kind === "whatsapp" && c.value === p.number)
		)
			add("phone", p.number, m[0], true);
	}
	return contacts;
}
export function contactsFromHTML(
	html: string,
	sourceUrl: string,
	website: string,
	verifiedCountry?: CountryCode,
) {
	const $ = load(html);
	$("script,style,noscript,template,input,textarea").remove();
	return extractPublicContacts({
		text: $("body").text().replace(/\s+/g, " "),
		links: $("a[href]")
			.toArray()
			.map((a) => $(a).attr("href") ?? ""),
		sourceUrl,
		website,
		verifiedCountry,
		method:
			"Operator-requested public website page; robots checked; no login or restriction bypass",
	});
}
export function contactsFromSources(
	sources: SourceEvidence[],
	website: string,
	verifiedCountry?: CountryCode,
) {
	return sources.flatMap((s) =>
		extractPublicContacts({
			text: s.title + " " + s.snippet,
			links: [s.url],
			sourceUrl: s.url,
			website,
			verifiedCountry,
			collectedAt: s.collectedAt,
			method:
				"Public search-engine indexed text; ownership and WhatsApp availability not automatically verified",
			engine: s.engine === "manual" ? undefined : s.engine,
			query: s.query,
		}),
	);
}
export function bestPublicWhatsApp(contacts: ContactEvidence[]) {
	return (
		contacts.find(
			(c) =>
				c.kind === "whatsapp" &&
				c.format === "valid" &&
				c.identity === "manually-confirmed",
		) ??
		contacts.find(
			(c) =>
				c.kind === "whatsapp" &&
				c.format === "valid" &&
				c.association !== "related-unverified",
		)
	);
}

export function combineContactEvidence(contacts: ContactEvidence[]) {
	const grouped = new Map<string, ContactEvidence[]>();
	for (const c of contacts) {
		const key = c.kind + ":" + c.value.toLowerCase().replace(/\/$/, "");
		grouped.set(key, [...(grouped.get(key) ?? []), c]);
	}
	return [...grouped.values()].map((group) => {
		const primary =
			group.find((c) => c.identity === "manually-confirmed") ??
			group.find((c) => c.association !== "related-unverified") ??
			group[0];
		return {
			...primary,
			sources: group.map((c) => ({
				url: c.sourceUrl,
				method: c.method,
				collectedAt: c.collectedAt,
			})),
			evidenceIDs: group.map((c) => c.id),
		};
	});
}

export function scopeContact(
	contact: ContactEvidence,
	leadID: string,
): ContactEvidence {
	return { ...contact, id: stableID(leadID + "|" + contact.id, "contact-") };
}
