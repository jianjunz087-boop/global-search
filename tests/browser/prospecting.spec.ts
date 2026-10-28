import { test, expect } from "@playwright/test";
test("real queue fails explicitly without keys, logs both engines and retains saved search setup", async ({
	page,
	request,
}) => {
	await page.goto("/");
	await page.getByLabel("Search engine", { exact: true }).selectOption("both");
	await page
		.getByLabel("Keywords", { exact: true })
		.fill("SYNTHETIC NO-KEY TEST QUERY");
	await page.getByLabel("Target country").selectOption("Russia");
	await page
		.getByRole("button", { name: "Find customers", exact: true })
		.click();
	await expect(page.locator(".search-alert")).toContainText(
		"Configure your SerpAPI key",
	);
	await expect(page.locator(".prospect-engine-errors")).toContainText(
		"yandex: MISSING_API_KEY",
	);
	const list = await (await request.get("/api/prospecting/tasks")).json();
	const task = list.tasks.find(
		(t: any) => t.query.keyword === "SYNTHETIC NO-KEY TEST QUERY",
	);
	expect(task.state).toBe("failed");
	expect(task.usage).toBe(0);
	expect(task.errors.map((e: any) => e.engine).sort()).toEqual([
		"google",
		"yandex",
	]);
	await page
		.getByRole("button", { name: "Save search setup", exact: true })
		.click();
	await expect(page.locator(".prospect-controls")).toContainText(
		"Search setup saved",
	);
	await page.getByLabel("Keywords", { exact: true }).fill("unsaved draft");
	await page
		.getByRole("button", { name: "Restore saved setup", exact: true })
		.click();
	await expect(page.getByLabel("Keywords", { exact: true })).toHaveValue(
		"SYNTHETIC NO-KEY TEST QUERY",
	);
	await expect(page.getByLabel("Search engine", { exact: true })).toHaveValue(
		"both",
	);
});
test("source-linked imported contacts, manual ownership review, country/city review, evidence filtering and export work", async ({
	page,
	request,
}) => {
	const name =
		"SYNTHETIC BROWSER PROSPECT " + Date.now() + " — not a real customer";
	const site = "https://browser-upgrade-" + Date.now() + ".example";
	const city = "Test City " + Date.now();
	const imported = await request.post("/api/prospecting/import", {
		data: {
			rows: [
				{
					name,
					website: site,
					source: site + "/contact",
					type: "Wholesaler",
					country: "Russia",
					email: "trade@browser-fixture.example",
					whatsapp: "+44 7700 900123",
				},
			],
		},
	});
	expect(imported.status()).toBe(200);
	await page.goto("/");
	const row = page.locator("tbody tr").filter({ hasText: name });
	await expect(row).toContainText("+447700900123");
	await expect(row).toContainText("Number pending ownership review");
	await row.getByRole("button", { name: "View " + name, exact: true }).click();
	await page
		.getByText("Multi-platform contacts, evidence & import analysis", {
			exact: true,
		})
		.click();
	const dossier = page.locator(".prospect-dossier");
	await expect(dossier).toContainText("No company-level import records");
	const contact = dossier
		.locator(".prospect-contact")
		.filter({ hasText: "whatsapp:" });
	await contact.locator("summary").click();
	await contact.getByLabel("Reviewer / 核查人").fill("SYNTHETIC TEST REVIEWER");
	await contact
		.getByLabel("How ownership was checked / 核查方式")
		.fill(
			"Synthetic browser fixture only; ownership assertion is not an actual verification",
		);
	await contact
		.getByRole("button", { name: "Save ownership review", exact: true })
		.click();
	await expect(contact).toContainText("ownership manually confirmed");
	await expect(contact).toContainText("availability not checked");
	const details = dossier.locator("details").filter({
		has: page
			.locator("summary")
			.filter({ hasText: "Review company identity & public claims" }),
	});
	await details.locator("summary").first().click();
	await details
		.getByLabel("Reviewer", { exact: true })
		.fill("SYNTHETIC TEST REVIEWER");
	await details.getByLabel("country", { exact: true }).fill("Russia");
	await details.getByLabel("city", { exact: true }).fill(city);
	await details
		.getByRole("button", {
			name: "Save manually reviewed identity",
			exact: true,
		})
		.click();
	await expect(dossier).toContainText(city);
	await page
		.getByRole("button", { name: "Close details", exact: true })
		.click();
	await page
		.getByText("B2B evidence filters & import/export", { exact: true })
		.click();
	await page.getByLabel("Verified city filter", { exact: true }).fill(city);
	await expect(page.locator("tbody tr")).toHaveCount(1);
	const download = page.waitForEvent("download");
	await page
		.getByRole("button", { name: "CSV + evidence", exact: true })
		.click();
	expect((await download).suggestedFilename()).toBe("BAIHUA-B2B-evidence.csv");
	await page.getByLabel("Rating / 客户评级", { exact: true }).selectOption("A");
	await expect(page.locator("tbody tr")).toHaveCount(0);
	await page
		.getByRole("button", { name: "Reset evidence filters", exact: true })
		.click();
	await expect(
		page.locator("tbody tr").filter({ hasText: name }),
	).toBeVisible();
	await page.setViewportSize({ width: 390, height: 844 });
	expect(
		await page.evaluate(
			() => document.documentElement.scrollWidth <= innerWidth,
		),
	).toBe(true);
});
test("new selected engines preserve partial results and expose per-engine errors in the existing table", async ({
	page,
}) => {
	const lead = {
		id: "SYNTHETIC-PARTIAL-RESULT",
		name: "SYNTHETIC PARTIAL SEARCH FIXTURE — not real",
		country: "Not verified",
		targetCountry: "Russia",
		type: "Unverified B2B candidate",
		website: "https://partial-fixture.example",
		source: "https://partial-fixture.example/contact",
		email: "",
		whatsapp: "",
		score: 0,
		status: "New",
		note: "Synthetic browser response only",
		nextFollowUp: "",
		tags: [],
		mock: false,
	};
	await page.route("**/api/search", (r) =>
		r.fulfill({ status: 202, json: { taskId: "synthetic-task" } }),
	);
	await page.route("**/api/prospecting/tasks?id=synthetic-task", (r) =>
		r.fulfill({
			json: {
				task: { state: "partial", usage: 2 },
				results: [lead],
				ids: [lead.id],
				count: 1,
				added: 1,
				existing: 0,
				query: "SYNTHETIC FIXTURE QUERY",
				page: 1,
				hasNext: false,
				errors: [
					{
						engine: "yandex",
						code: "QUOTA_EXCEEDED",
						message: "Synthetic quota error, no real API request",
					},
				],
			},
		}),
	);
	await page.goto("/");
	await page.getByLabel("Search engine", { exact: true }).selectOption("both");
	await page
		.getByRole("button", { name: "Find customers", exact: true })
		.click();
	await expect(page.locator("tbody")).toContainText(
		"SYNTHETIC PARTIAL SEARCH FIXTURE",
	);
	await expect(page.locator(".prospect-engine-errors")).toContainText(
		"yandex: QUOTA_EXCEEDED",
	);
	await expect(page.locator(".search-summary")).toContainText("1 results");
});
