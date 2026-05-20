import { execSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { createReadStream, existsSync, statSync, watch } from "node:fs";
import { createServer } from "node:http";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { WebSocketServer } from "ws";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const distDirChrome = join(__dirname, "..", "dist-chrome");
const projectRoot = join(__dirname, "..");

const WS_PORT = 8765;
const HTTP_PORT = 8787;

const server = createServer();
const wss = new WebSocketServer({ noServer: true });

const clients = new Set();

// ── HTTP request handling (zip download + health) ──
server.on("request", (req, res) => {
	// CORS for cross-origin access from laptop
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === "/health") {
		res.writeHead(200, { "Content-Type": "text/plain" });
		res.end("ok");
		return;
	}

	if (req.url === "/dist-chrome.zip") {
		if (!existsSync(distDirChrome)) {
			res.writeHead(503, { "Content-Type": "text/plain" });
			res.end("dist-chrome not built yet. Run ./dev.sh first.");
			return;
		}

		try {
			const zipName = `dist-chrome-temp-${randomUUID().slice(0, 8)}.zip`;
			const zipPath = join(projectRoot, zipName);
			// Create zip in project root (not inside dist-chrome to avoid loops)
			execSync(`cd "${projectRoot}" && zip -r "${zipName}" dist-chrome -x "dist-chrome/pdfjs-dist/build/*" 2>&1`, {
				timeout: 30000,
			});

			const stat = statSync(zipPath);
			res.writeHead(200, {
				"Content-Type": "application/zip",
				"Content-Disposition": 'attachment; filename="lazyboy-extension.zip"',
				"Content-Length": stat.size,
			});

			const stream = createReadStream(zipPath);
			const cleanup = () => {
				try {
					execSync(`rm -f "${zipPath}"`);
				} catch {}
			};
			stream.pipe(res);
			stream.on("end", cleanup);
			stream.on("error", cleanup);
			res.on("close", cleanup);
			console.log(`[DevServer] Served dist-chrome.zip (${(stat.size / 1024 / 1024).toFixed(1)} MB)`);
		} catch (err) {
			// Clean up if zip creation fails
			try {
				execSync(`rm -f "${zipPath}"`);
			} catch {}
			res.writeHead(500, { "Content-Type": "text/plain" });
			res.end(`Failed to create zip: ${err.message}`);
		}
		return;
	}

	// 404 for everything else
	res.writeHead(404, { "Content-Type": "text/plain" });
	res.end("Not found. Endpoints: /health, /dist-chrome.zip");
});

// ── WebSocket upgrade handling ──
server.on("upgrade", (request, socket, head) => {
	if (request.url?.startsWith("/ws")) {
		wss.handleUpgrade(request, socket, head, (ws) => {
			wss.emit("connection", ws, request);
		});
	} else {
		socket.destroy();
	}
});

wss.on("connection", (ws) => {
	console.log("[DevServer] Client connected");
	clients.add(ws);

	ws.on("close", () => {
		console.log("[DevServer] Client disconnected");
		clients.delete(ws);
	});

	ws.on("error", (error) => {
		console.error("[DevServer] WebSocket error:", error);
		clients.delete(ws);
	});

	ws.send(JSON.stringify({ type: "connected" }));
});

// Watch for changes in dist-chrome
const watcherChrome = watch(distDirChrome, { recursive: true }, (_eventType, filename) => {
	if (filename) {
		console.log(`[DevServer] Chrome file changed: ${filename}`);
		const message = JSON.stringify({
			type: "reload",
			browser: "chrome",
			file: filename,
		});
		clients.forEach((client) => {
			if (client.readyState === 1) {
				client.send(message);
			}
		});
	}
});

// Start server on 0.0.0.0 for Tailscale access
server.listen(HTTP_PORT, "0.0.0.0", () => {
	// Try to get Tailscale IP
	let tailscaleIP = "";
	try {
		tailscaleIP = execSync("tailscale ip -4 2>/dev/null", { encoding: "utf8" }).trim();
	} catch {}

	console.log(`[DevServer] HTTP server on http://0.0.0.0:${HTTP_PORT}`);
	console.log(`[DevServer] WebSocket on ws://0.0.0.0:${WS_PORT}/ws`);
	if (tailscaleIP) {
		console.log(`[DevServer] 📦 Extension zip: http://${tailscaleIP}:${HTTP_PORT}/dist-chrome.zip`);
	}
	console.log(`[DevServer] Watching: ${distDirChrome}`);
});

// Graceful shutdown
process.on("SIGINT", () => {
	console.log("\n[DevServer] Shutting down...");
	watcherChrome.close();
	for (const client of clients) {
		client.close();
	}
	server.close(() => {
		process.exit(0);
	});
});
