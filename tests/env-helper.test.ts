import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const { ensureConfigFile } = createRequire(import.meta.url)(
	"../scripts/configure-env.cjs",
);
test("local configuration preserves existing BOM/export/whitespace credentials instead of appending an overriding blank key", () => {
	const file = join(mkdtempSync(join(tmpdir(), "baihua-env-")), ".env.local");
	const text =
		"\uFEFFexport SERPAPI_API_KEY = SYNTHETIC-TEST-NOT-REAL\r\n  YANDEX_SERPAPI_KEY = SYNTHETIC-OTHER-TEST\r\nCUSTOM_SETTING=keep\r\n";
	writeFileSync(file, text);
	ensureConfigFile(file);
	assert.equal(readFileSync(file, "utf8"), text);
});
test("local configuration adds missing empty names idempotently and handles Windows UTF16 without losing existing values", () => {
	const file = join(mkdtempSync(join(tmpdir(), "baihua-env-")), ".env.local");
	writeFileSync(
		file,
		Buffer.concat([
			Buffer.from([255, 254]),
			Buffer.from("SERPAPI_API_KEY=SYNTHETIC-TEST-NOT-REAL\r\n", "utf16le"),
		]),
	);
	ensureConfigFile(file);
	const first = readFileSync(file, "utf8");
	assert.ok(first.includes("SERPAPI_API_KEY=SYNTHETIC-TEST-NOT-REAL"));
	assert.equal(first.match(/^SERPAPI_API_KEY=/gm)?.length, 1);
	assert.ok(first.includes("YANDEX_SERPAPI_KEY="));
	ensureConfigFile(file);
	assert.equal(readFileSync(file, "utf8"), first);
});
