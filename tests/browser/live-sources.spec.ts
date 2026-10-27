import { test, expect } from "@playwright/test";
test("live collection UI keeps missing keys explicit and collects only on a deliberate click", async ({
	page,
}) => {
	let configured = false,
		requests = 0,
		haveResults = false;
	await page.route("**/api/intelligence", async (route) => {
		const response = await route.fetch();
		const data = await response.json();
		await route.fulfill({
			response,
			json: {
				...data,
				sources: data.sources.map((s: { id: string; configured: boolean }) =>
					s.id === "google-trends" ? { ...s, configured } : s,
				),
				observations: haveResults
					? [
							...data.observations,
							{
								id: "synthetic-ui-api-fixture",
								name: "Google Trends · SYNTHETIC UI FIXTURE",
								country: "United States",
								product: "DIY Cluster Lashes",
								period: new Date().toISOString().slice(0, 10),
								value: 42,
								unit: "search interest index (0–100)",
								method: "Synthetic UI fixture — no real API request",
								limitations: "Not actual market evidence",
								sourceUrl: "https://trends.google.com/trends/explore?q=fixture",
								collectedAt: new Date().toISOString(),
								sourceId: "google-trends",
							},
						]
					: data.observations,
			},
		});
	});
	await page.route("**/api/intelligence/collect", async (route) => {
		requests++;
		expect(route.request().postDataJSON()).toMatchObject({
			source: "google-trends",
			country: "United States",
			product: "DIY Cluster Lashes",
		});
		haveResults = true;
		await route.fulfill({
			json: {
				source: "google-trends",
				received: 1,
				skipped: 0,
				cached: false,
				collectedAt: new Date().toISOString(),
				message: "Synthetic UI fixture — no real provider request",
			},
		});
	});
	await page.goto("/intelligence");
	await page
		.getByRole("button", { name: "Data Sources", exact: false })
		.click();
	await expect(
		page.getByRole("button", { name: "Collect real data", exact: true }),
	).toBeDisabled();
	await expect(page.getByText(/Missing key: double-click/)).toBeVisible();
	expect(requests).toBe(0);
	configured = true;
	await page.reload();
	await page
		.getByRole("button", { name: "Data Sources", exact: false })
		.click();
	await page
		.getByRole("button", { name: "Collect real data", exact: true })
		.click();
	await expect(page.getByRole("status")).toContainText("1 records");
	expect(requests).toBe(1);
	await page.getByRole("button", { name: "Products", exact: false }).click();
	await expect(
		page.getByRole("img", { name: /Google Trends · SYNTHETIC UI FIXTURE/ }),
	).toBeVisible();
	await expect(
		page.getByText(/API search-interest index · not sales/),
	).toBeVisible();
});
test("provider failures remain visible in the UI and no results are fabricated", async ({
	page,
}) => {
	await page.route("**/api/intelligence", async (route) => {
		const response = await route.fetch();
		const data = await response.json();
		await route.fulfill({
			response,
			json: {
				...data,
				sources: data.sources.map((s: { id: string }) =>
					s.id === "google-trends" ? { ...s, configured: true } : s,
				),
			},
		});
	});
	await page.route("**/api/intelligence/collect", (route) =>
		route.fulfill({
			status: 429,
			json: {
				code: "QUOTA_EXCEEDED",
				error: "Synthetic quota error — no real provider request",
			},
		}),
	);
	await page.goto("/intelligence");
	await page
		.getByRole("button", { name: "Data Sources", exact: false })
		.click();
	await page
		.getByRole("button", { name: "Collect real data", exact: true })
		.click();
	await expect(
		page.getByRole("alert").filter({ hasText: "QUOTA_EXCEEDED" }),
	).toContainText("QUOTA_EXCEEDED");
	await expect(
		page.getByRole("button", { name: "Collect real data", exact: true }),
	).toBeEnabled();
});
