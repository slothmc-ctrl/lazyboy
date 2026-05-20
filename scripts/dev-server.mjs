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
let tailscaleIP = "";

// ── Landing page HTML (served at /) ──
function landingPage(piIP) {
	return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🦥 Lazyboy — Install</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:system-ui,sans-serif;background:#0f0f0f;color:#e0e0e0;min-height:100vh;display:flex;justify-content:center;padding:40px 20px}
.c{max-width:600px;width:100%}
h1{font-size:2.4rem;text-align:center;color:#ff8c42;margin-bottom:8px}
.sub{text-align:center;color:#888;margin-bottom:32px}
.card{background:#1a1a1a;border:1px solid #2a2a2a;border-radius:14px;padding:24px 28px;margin-bottom:16px;border-left:4px solid #ff8c42}
.card h2{font-size:1.1rem;color:#fff;margin-bottom:8px}
.card p{color:#aaa;line-height:1.5;font-size:0.92rem}
.btn{display:block;text-align:center;background:#ff8c42;color:#0f0f0f;font-weight:700;font-size:1.1rem;padding:14px 24px;border-radius:10px;text-decoration:none;margin:12px 0;transition:background .15s}
.btn:hover{background:#ff6b1a}
code{background:#2a2a2a;padding:2px 7px;border-radius:5px;color:#ff8c42;font-weight:600;font-size:0.9rem}
.cmd{background:#1a1a2e;border:1px solid #3a3a5e;border-radius:8px;padding:12px 16px;font-family:monospace;font-size:0.82rem;color:#aaccff;word-break:break-all;margin:8px 0;overflow-x:auto}
.note{background:#1e2a1e;border:1px solid #2d4a2d;border-radius:8px;padding:12px 16px;font-size:0.9rem;color:#aaa;margin-top:8px}
</style>
</head>
<body>
<div class="c">
<h1>🦥 Install Lazyboy</h1>
<p class="sub">Get the extension onto your Chrome in one click</p>

<div class="card">
<h2>1. Download</h2>
<a class="btn" href="/dist-chrome.zip" download>⬇ Download Extension</a>
<p style="text-align:center;color:#666;font-size:0.8rem">Zip file, ~17 MB</p>
<p style="margin-top:8px">Or copy this command to your terminal:</p>
<div class="cmd">curl -o ~/Downloads/lazyboy.zip ${piIP ? `http://${piIP}:8787` : "http://<pi-ip>:8787"}/dist-chrome.zip && unzip -qo ~/Downloads/lazyboy.zip -d ~/lazyboy-extension && mv ~/lazyboy-extension/dist-chrome/* ~/lazyboy-extension/ && rm -rf ~/lazyboy-extension/dist-chrome ~/Downloads/lazyboy.zip && echo "✅ Ready in ~/lazyboy-extension"</div>
</div>

<div class="card">
<h2>2. Load in Chrome</h2>
<p>Open <code>chrome://extensions/</code> → toggle <strong>Developer mode</strong> ON → click <strong>Load unpacked</strong> → select:</p>
<div class="cmd">~/lazyboy-extension</div>
</div>

<div class="card">
<h2>3. Pin & grant permissions</h2>
<p>Click <strong>Details</strong> on the lazyboy card, then enable:</p>
<p style="margin-top:6px">✅ Allow access to file URLs<br>✅ Allow user scripts (if shown)</p>
<p style="margin-top:10px">Then click the 🧩 puzzle icon → 📌 pin <strong>lazyboy</strong></p>
<p style="margin-top:8px">Open with <code>Ctrl+Shift+S</code> or click the icon!</p>
</div>

<div class="note">
💡 <strong>To update</strong> after code changes on the Pi: just re-download and re-extract, then click ↻ on the extension card in Chrome.
</div>

${piIP ? `<p style="text-align:center;color:#555;font-size:0.75rem;margin-top:24px">Served from ${piIP}</p>` : ""}
</div>
</body>
</html>`;
}

// ── HTTP request handling ──
server.on("request", (req, res) => {
	// CORS for cross-origin access from laptop
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");

	if (req.method === "OPTIONS") {
		res.writeHead(204);
		res.end();
		return;
	}

	if (req.url === "/" || req.url === "/index.html") {
		const html = landingPage(tailscaleIP);
		res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
		res.end(html);
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

		const zipName = `dist-chrome-temp-${randomUUID().slice(0, 8)}.zip`;
		const zipPath = join(projectRoot, zipName);
		try {
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
	res.end("Not found. Try / for the install page, /health for status, /dist-chrome.zip for download.");
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
try {
	tailscaleIP = execSync("tailscale ip -4 2>/dev/null", { encoding: "utf8" }).trim();
} catch {}

server.listen(HTTP_PORT, "0.0.0.0", () => {
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
