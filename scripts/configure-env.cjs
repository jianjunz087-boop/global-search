// Prepare variable names only. Existing credential values are never printed or replaced.
const fs = require("node:fs");
function ensureConfigFile(filename) {
	const data = fs.existsSync(filename)
		? fs.readFileSync(filename)
		: Buffer.alloc(0);
	const utf16 = data[0] === 255 && data[1] === 254;
	let text = utf16
		? data.subarray(2).toString("utf16le")
		: data.toString("utf8");
	const newline = text.includes("\r\n")
		? "\r\n"
		: process.platform === "win32"
			? "\r\n"
			: "\n";
	let changed = utf16;
	for (const name of ["SERPAPI_API_KEY", "YANDEX_SERPAPI_KEY"]) {
		const defined = new RegExp(
			"^[\\s\\uFEFF]*(?:export[ \\t]+)?" + name + "[ \\t]*=",
			"m",
		).test(text);
		if (!defined) {
			if (text && !text.endsWith("\n")) text += newline;
			text += name + "=" + newline;
			changed = true;
		}
	}
	if (changed || !fs.existsSync(filename))
		fs.writeFileSync(filename, text, "utf8");
}
module.exports = { ensureConfigFile };
if (require.main === module) {
	try {
		ensureConfigFile(require("node:path").join(process.cwd(), ".env.local"));
		console.log("Local environment file prepared. Existing values retained.");
	} catch {
		console.error(
			"Unable to prepare .env.local. Check folder permissions; no credential values were printed.",
		);
		process.exitCode = 1;
	}
}
