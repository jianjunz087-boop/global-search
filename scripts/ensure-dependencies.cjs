// Refresh only when the frozen lockfile changed. Never read or print credentials.
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { spawnSync } = require("node:child_process");
const root = path.resolve(__dirname, ".."),
	marker = path.join(root, "node_modules", ".baihua-lock-sha256");
const digest = crypto
	.createHash("sha256")
	.update(fs.readFileSync(path.join(root, "package-lock.json")))
	.digest("hex");
if (
	fs.existsSync(path.join(root, "node_modules", "next", "package.json")) &&
	fs.existsSync(marker) &&
	fs.readFileSync(marker, "utf8").trim() === digest
) {
	console.log("Dependencies match the locked version.");
	process.exit(0);
}
console.log(
	"Installing locked dependencies for this project version. Keep this window open.",
);
const result =
	process.platform === "win32"
		? spawnSync("cmd.exe", ["/d", "/c", "npm.cmd ci"], {
				cwd: root,
				stdio: "inherit",
			})
		: spawnSync("npm", ["ci"], { cwd: root, stdio: "inherit" });
if (result.error || result.status !== 0) {
	console.error("Dependency installation failed. Check the npm output above.");
	process.exit(result.status || 1);
}
fs.writeFileSync(marker, digest + "\n");
