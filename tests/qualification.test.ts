import { test } from "node:test";
import assert from "node:assert/strict";
import { qualifyBusiness } from "../lib/prospecting/qualification";
import { discoveryText, validateDiscovery } from "../lib/prospecting/queries";
const source = (
	title: string,
	snippet = "",
	url = "https://fixture.example/",
) => ({ title, snippet, url });
test("qualifies eyelash businesses from page evidence, not target keywords", () => {
	assert.equal(
		qualifyBusiness(source("Automotive wholesale", "Car parts distributor"))
			.accepted,
		false,
	);
	assert.equal(
		qualifyBusiness(
			source("Lash supplies shop", "Eyelash extensions wholesale"),
		).accepted,
		true,
	);
	assert.equal(
		qualifyBusiness(source("Beauty store", "Professional lash supplies"))
			.accepted,
		true,
	);
	assert.equal(
		qualifyBusiness(source("Ресницы оптом", "Магазин")).accepted,
		true,
	);
	assert.equal(
		qualifyBusiness(source("How to apply lashes", "Tutorial")).accepted,
		false,
	);
});
test("filters China seller evidence without treating mentions of Chinese sourcing as seller location", () => {
	for (const item of [
		source("China eyelash manufacturer"),
		source("Lash supplier", "Based in Qingdao"),
		source("Eyelash shop", "", "https://lashes.cn/"),
		source("Eyelash wholesale", "", "https://seller.en.alibaba.com/"),
	])
		assert.equal(qualifyBusiness(item).accepted, false);
	assert.equal(
		qualifyBusiness(
			source("UK eyelash distributor", "We import lashes from China"),
		).accepted,
		true,
	);
	assert.equal(
		qualifyBusiness(source("Eyelash store")).countryStatus,
		"unverified",
	);
});
test("generic keywords retain eyelash scope and marketplace exclusions, enrichment stays company scoped", () => {
	const q = validateDiscovery({
		keyword: "beauty",
		country: "Australia",
		engine: "google",
	});
	assert.match(discoveryText(q), /eyelash OR lashes/);
	assert.match(discoveryText(q), /-site:alibaba.com/);
	assert.doesNotMatch(
		discoveryText(
			{ ...q, intent: "whatsapp" },
			{ name: "Fixture", website: "https://fixture.example/" },
		),
		/-site:/,
	);
});
