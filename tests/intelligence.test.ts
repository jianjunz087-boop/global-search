import { test } from "node:test";
import assert from "node:assert/strict";
import {
	score,
	parseCSV,
	csv,
	domain,
	initialMarkets,
} from "../lib/intelligence/model";
import { UnconfiguredAdapter } from "../lib/intelligence/adapters";
test("weighted opportunity handles absent evidence and coverage transparently", () => {
	assert.deepEqual(score([100, null, null, null, null, null]), {
		score: 100,
		coverage: 25,
	});
	assert.deepEqual(score([null, null, null, null, null, null]), {
		score: null,
		coverage: 0,
	});
	assert.equal(score([50, 50, 50, 50, 50, 50]).score, 50);
	assert.ok(initialMarkets.every((m) => m.kind === "demo"));
});
test("CSV parses quoted delimiters, multiline fields, BOM and escaping", () => {
	const rows = parseCSV('name,note\r\n"A, B","line 1\nline ""2"""\r\n');
	assert.equal(rows[1][0], "A, B");
	assert.equal(rows[1][1], 'line 1\nline "2"');
	assert.throws(() => parseCSV('"unclosed'));
	assert.ok(csv([["=CMD()", 'a"b']]).includes("'=CMD()"));
});
test("deduplication normalizes company host and rejects executable URLs", () => {
	assert.equal(domain("https://www.Example.org/path"), "example.org");
	assert.throws(() => domain("javascript:alert(1)"));
});
test("unconfigured source refuses collection rather than fabricating observations", async () => {
	const adapter = new UnconfiguredAdapter("trade");
	assert.equal(adapter.status().configured, false);
	await assert.rejects(() => adapter.collect(), /no collection performed/);
});
