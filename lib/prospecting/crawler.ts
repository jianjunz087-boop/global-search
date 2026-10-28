import { lookup } from "node:dns/promises";
import { request } from "node:https";
import type { LookupFunction } from "node:net";
import ipaddr from "ipaddr.js";
import robotsParser from "robots-parser";
import { load } from "cheerio";
import { platformOf, safeURL } from "./identity";
export const crawlerAgent = "BaihuaPublicContactResearch/1.0";
export function publicIP(value: string) {
	try {
		const address = ipaddr.process(value);
		return address.range() === "unicast";
	} catch {
		return false;
	}
}
export async function validatePublicWebsite(
	value: string,
	resolver: typeof lookup = lookup,
) {
	const u = safeURL(value);
	if (
		!u ||
		u.protocol !== "https:" ||
		(u.port && u.port !== "443") ||
		platformOf(u.href) !== "web" ||
		/^(?:localhost|.*\.localhost|.*\.local)$/i.test(u.hostname)
	)
		throw new Error("WEBSITE_NOT_ALLOWED");
	const addresses = await resolver(u.hostname, { all: true });
	if (!addresses.length || addresses.some((a) => !publicIP(a.address)))
		throw new Error("PRIVATE_ADDRESS_BLOCKED");
	return { url: u, address: addresses[0] };
}
async function pinnedGET(value: string) {
	// Do not evade an environment-managed proxy. Fall back to indexed evidence there.
	if (
		process.env.HTTPS_PROXY ||
		process.env.https_proxy ||
		process.env.HTTP_PROXY ||
		process.env.http_proxy ||
		process.env.ALL_PROXY ||
		process.env.all_proxy
	)
		throw new Error("PINNED_CRAWL_UNAVAILABLE_WITH_PROXY_USE_INDEXED_SEARCH");
	const { url, address } = await validatePublicWebsite(value);
	return await new Promise<{
		status: number;
		body: string;
		type: string;
		location?: string;
	}>((resolve, reject) => {
		const req = request(
			url,
			{
				method: "GET",
				headers: { "User-Agent": crawlerAgent, Accept: "text/html,text/plain" },
				lookup: ((_host: string, opts: any, cb: any) =>
					opts?.all
						? cb(null, [address])
						: cb(null, address.address, address.family)) as LookupFunction,
			},
			(res) => {
				let size = 0;
				const chunks: Buffer[] = [];
				res.on("data", (part: Buffer) => {
					size += part.length;
					if (size > 1024 * 1024) {
						res.destroy();
						reject(new Error("PAGE_TOO_LARGE"));
					} else chunks.push(part);
				});
				res.on("end", () =>
					resolve({
						status: res.statusCode ?? 0,
						body: Buffer.concat(chunks).toString("utf8"),
						type: res.headers["content-type"] ?? "",
						location: res.headers.location,
					}),
				);
				res.on("error", () => reject(new Error("PAGE_FETCH_FAILED")));
			},
		);
		req.setTimeout(8000, () => req.destroy(new Error("PAGE_TIMEOUT")));
		req.on("error", () => reject(new Error("PAGE_FETCH_FAILED")));
		req.end();
	});
}
export async function collectWebsitePages(
	website: string,
	options: { getter?: typeof pinnedGET } = {},
) {
	const get = options.getter ?? pinnedGET,
		u = safeURL(website);
	if (!u || u.protocol !== "https:" || platformOf(u.href) !== "web")
		return {
			pages: [],
			failures: [
				"Only explicitly confirmed HTTPS company sites may be visited; social platforms remain index-only.",
			],
		};
	const origin = u.origin;
	const pages: { url: string; html: string }[] = [],
		failures: string[] = [];
	try {
		const robots = await get(origin + "/robots.txt");
		if (robots.status !== 404 && robots.status !== 200)
			return { pages, failures: ["ROBOTS_UNAVAILABLE_NO_CRAWL"] };
		const policy = robotsParser(
			origin + "/robots.txt",
			robots.status === 200 ? robots.body : "",
		);
		const delay = Math.max(
			1000,
			(policy.getCrawlDelay(crawlerAgent) ?? 1) * 1000,
		);
		if (delay > 3000)
			return {
				pages,
				failures: [
					"SITE_CRAWL_DELAY_REQUIRES_SEPARATE_WORKER; indexed results only",
				],
			};
		const pending = [origin + "/"];
		let robotsChecked = true;
		while (pending.length && pages.length < 4) {
			const page = pending.shift()!;
			if (!policy.isAllowed(page, crawlerAgent)) {
				failures.push("ROBOTS_DISALLOWED: " + page);
				continue;
			}
			await new Promise((r) => setTimeout(r, delay));
			try {
				let response = await get(page),
					effective = page;
				if (
					[301, 302, 307, 308].includes(response.status) &&
					response.location
				) {
					const target = new URL(response.location, page);
					if (
						target.origin !== origin ||
						!policy.isAllowed(target.href, crawlerAgent)
					) {
						failures.push("REDIRECT_SCOPE_BLOCKED");
						continue;
					}
					effective = target.href;
					response = await get(effective);
				}
				if (response.status !== 200 || !response.type.includes("text/html")) {
					failures.push(`HTTP_${response.status}: ${effective}`);
					continue;
				}
				if (
					/captcha|verify you are human|cf-chl|access denied/i.test(
						response.body.slice(0, 15000),
					)
				) {
					failures.push("ACCESS_RESTRICTION_NO_BYPASS");
					continue;
				}
				pages.push({ url: effective, html: response.body });
				if (robotsChecked) {
					robotsChecked = false;
					const $ = load(response.body);
					for (const link of $("a[href]").toArray()) {
						const href = $(link).attr("href") ?? "";
						try {
							const found = new URL(href, origin);
							if (
								found.origin === origin &&
								/contact|about|wholesale|контакт/i.test(found.pathname) &&
								!pending.includes(found.href) &&
								pending.length < 3
							)
								pending.push(found.href);
						} catch {}
					}
				}
			} catch {
				failures.push("PUBLIC_PAGE_UNAVAILABLE");
			}
		}
	} catch (e) {
		failures.push(e instanceof Error ? e.message : "WEBSITE_FETCH_UNAVAILABLE");
	}
	return { pages, failures };
}
