import { readFile } from "node:fs/promises";
import { test, expect } from "@playwright/test";
test("intelligence country comparison, persistent CRM, imports, reports and mobile navigation", async ({
	page,
	request,
}) => {
	await page.goto("/intelligence");
	await expect(
		page.getByText("Market opportunity ranking", { exact: true }),
	).toBeVisible();
	await page
		.getByRole("checkbox", { name: "Compare Russia", exact: true })
		.check();
	await page
		.getByRole("checkbox", { name: "Compare Germany", exact: true })
		.check();
	await expect(page.getByText("2 selected", { exact: true })).toBeVisible();
	await page.getByRole("button", { name: "B2B Leads", exact: false }).click();
	await page.getByRole("button", { name: "+ Add buyer", exact: true }).click();
	const dialog = page.getByRole("dialog", { name: "Buyer editor" });
	const name = `SYNTHETIC TEST FIXTURE ${Date.now()} — not a real buyer`;
	const host = `https://fixture-${Date.now()}.example`;
	await dialog.getByLabel("name", { exact: true }).fill(name);
	await dialog.getByLabel("country", { exact: true }).fill("Russia");
	await dialog.getByLabel("website", { exact: true }).fill(host);
	await dialog.getByLabel("source", { exact: true }).fill(host + "/about");
	await dialog.getByRole("button", { name: "Save buyer", exact: true }).click();
	await expect(dialog).not.toBeVisible();
	await expect(page.getByRole("button", { name, exact: true })).toBeVisible();
	await page.reload();
	await page.getByRole("button", { name: "B2B Leads", exact: false }).click();
	await page.getByRole("button", { name, exact: true }).click();
	await dialog
		.getByLabel("note", { exact: true })
		.fill("Persistence verified by browser test");
	await dialog.getByRole("button", { name: "Save buyer", exact: true }).click();
	const exported = page.waitForEvent("download");
	await page.getByRole("button", { name: "CSV", exact: true }).click();
	expect((await exported).suggestedFilename()).toBe("b2b-leads.csv");
	await page.locator("input[type=file]").setInputFiles({
		name: "fixture.csv",
		mimeType: "text/csv",
		buffer: Buffer.from(
			`name,country,website,type,source\n${name},Russia,${host},Wholesaler,${host}/about`,
		),
	});
	await expect(page.getByRole("status")).toContainText("duplicate");
	const invalid = await request.post("/api/intelligence", {
		data: { kind: "settings", item: { weights: [1, 2], reminders: "" } },
	});
	expect(invalid.status()).toBe(400);
	await page.getByRole("button", { name: "Reports", exact: false }).click();
	await page.getByRole("button", { name: "Generate English report" }).click();
	await expect(page.locator("#mi-report")).toContainText(name);
	await page.emulateMedia({ media: "print" });
	await page.pdf({ path: "/tmp/baihua-intelligence-report.pdf", format: "A4" });
	await page.emulateMedia({ media: "screen" });
	await page.setViewportSize({ width: 390, height: 844 });
	await page
		.getByRole("button", { name: "Data Sources", exact: false })
		.click();
	await expect(
		page.getByRole("heading", {
			name: "Source transparency & API configuration",
		}),
	).toBeVisible();
});
test("source observations validate evidence and survive API retrieval", async ({
	request,
}) => {
	const missing = await request.post("/api/intelligence", {
		data: { kind: "observation", item: { name: "fixture" } },
	});
	expect(missing.status()).toBe(400);
	const result = await request.post("/api/intelligence", {
		data: {
			kind: "observation",
			item: {
				name: "SYNTHETIC TEST SOURCE",
				country: "Russia",
				product: "DIY Cluster Lashes",
				period: "2026-10-01",
				value: 12,
				unit: "test units — not sales",
				method: "Synthetic test fixture",
				limitations: "Not real market data",
				sourceUrl: "https://source.example/fixture",
			},
		},
	});
	expect(result.ok()).toBeTruthy();
	const data = await (await request.get("/api/intelligence")).json();
	expect(
		data.observations.some(
			(o: { name: string }) => o.name === "SYNTHETIC TEST SOURCE",
		),
	).toBeTruthy();
});
test("Excel round trip, bulk qualification, settings, country creation and sourced chart", async ({
	page,
	request,
}) => {
	await page.goto("/intelligence");
	await expect(
		page.getByText("Market opportunity ranking", { exact: true }),
	).toBeVisible();
	await page.getByRole("button", { name: "B2B Leads", exact: false }).click();
	const exported = page.waitForEvent("download");
	await page.getByRole("button", { name: "Excel", exact: true }).click();
	const xlsx = await exported;
	expect(xlsx.suggestedFilename()).toBe("b2b-leads.xlsx");
	const path = await xlsx.path();
	expect(path).toBeTruthy();
	await page
		.locator("input[type=file]")
		.setInputFiles({
			name: "roundtrip.xlsx",
			mimeType:
				"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
			buffer: await readFile(path!),
		});
	await expect(page.getByRole("status")).toContainText("duplicate");
	const check = page.getByRole("checkbox").first();
	await check.check();
	await page
		.getByRole("button", { name: "Qualify selected (1)", exact: true })
		.click();
	await expect(
		page.getByRole("button", { name: "Qualify selected (0)", exact: true }),
	).toBeVisible();
	const r = await request.post("/api/intelligence", {
		data: {
			kind: "settings",
			item: {
				weights: [20, 20, 20, 20, 10, 10],
				reminders: "Weekly report preference (scheduler disabled)",
			},
		},
	});
	expect(r.ok()).toBeTruthy();
	await page.getByRole("button", { name: "Markets", exact: false }).click();
	await page
		.getByRole("button", { name: "+ Add country", exact: true })
		.click();
	const dialog = page.getByRole("dialog", { name: "Country details" });
	await dialog
		.getByPlaceholder("Country name")
		.fill("TEST COUNTRY — synthetic fixture");
	await dialog.getByPlaceholder("Local languages").fill("Test language");
	await dialog
		.getByRole("button", { name: "Save country", exact: true })
		.click();
	await expect(dialog).not.toBeVisible();
	await page.getByRole("button", { name: "Products", exact: false }).click();
	await expect(
		page.getByRole("img", { name: /SYNTHETIC TEST SOURCE/ }).first(),
	).toBeVisible();
	await page.getByRole("button", { name: "Competitors", exact: false }).click();
	await page
		.getByRole("button", { name: "+ Add public brand observation" })
		.click();
	const record = page.getByRole("dialog", { name: "Source observation" });
	await record
		.getByLabel("name", { exact: true })
		.fill("TEST BRAND — not real");
	await record.getByLabel("country", { exact: true }).fill("Russia");
	await record
		.getByLabel("sourceUrl", { exact: true })
		.fill("https://brand-test.example");
	await record.getByRole("button", { name: "Save observation" }).click();
	await expect(record).not.toBeVisible();
	await expect(page.getByText("TEST BRAND — not real · Russia")).toBeVisible();
});
