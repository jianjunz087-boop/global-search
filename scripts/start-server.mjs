import { existsSync, cpSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawn } from "node:child_process";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const standalone = path.join(root, ".next", "standalone");
if (!existsSync(path.join(standalone, "server.js"))) {
	console.error("Build output missing. Run npm run build first.");
	process.exit(1);
}
// Load private runtime configuration on this server only; never copy it into public assets.
const localEnv = path.join(root, ".env.local");
if (existsSync(localEnv)) process.loadEnvFile(localEnv);
const args = process.argv.slice(2);
const portIndex = args.indexOf("--port");
const port = portIndex >= 0 ? args[portIndex + 1] : process.env.PORT || "3000";
if (!/^\d+$/.test(port ?? "") || Number(port) < 1 || Number(port) > 65535) {
	console.error("Choose a valid server port.");
	process.exit(1);
}
mkdirSync(path.join(standalone, ".next"), { recursive: true });
cpSync(
	path.join(root, ".next", "static"),
	path.join(standalone, ".next", "static"),
	{ recursive: true },
);
if (existsSync(path.join(root, "public")))
	cpSync(path.join(root, "public"), path.join(standalone, "public"), {
		recursive: true,
	});
const server = spawn(process.execPath, [path.join(standalone, "server.js")], {
	cwd: root,
	stdio: "inherit",
	env: {
		...process.env,
		PORT: port,
		HOSTNAME: process.env.BAIHUA_BIND_HOST || "0.0.0.0",
	},
});
for (const signal of ["SIGTERM", "SIGINT"])
	process.on(signal, () => server.kill(signal));
server.on("error", () => {
	console.error("Unable to launch the built server.");
	process.exitCode = 1;
});
server.on("exit", (code) => {
	process.exitCode = code ?? 1;
});
