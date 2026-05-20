import { execFile } from "child_process";

const MAX_MESSAGE_SIZE = 1024 * 1024;

function readMessage(): Promise<object | null> {
	return new Promise((resolve) => {
		const buffer = Buffer.allocUnsafe(4);
		process.stdin.read(0, 4, (err, bytesRead, buf) => {
			if (err || bytesRead !== 4) {
				resolve(null);
				return;
			}
			const length = buf.readUInt32LE(0);
			if (length > MAX_MESSAGE_SIZE) {
				resolve(null);
				return;
			}
			const msgBuffer = Buffer.allocUnsafe(length);
			process.stdin.read(0, length, (_err2, bytesRead2, buf2) => {
				if (_err2 || bytesRead2 !== length) {
					resolve(null);
					return;
				}
				try {
					resolve(JSON.parse(buf2.toString("utf8")));
				} catch {
					resolve(null);
				}
			});
		});
	});
}

function sendMessage(obj: Record<string, unknown>) {
	const payload = JSON.stringify(obj);
	const buffer = Buffer.allocUnsafe(4 + Buffer.byteLength(payload));
	buffer.writeUInt32LE(Buffer.byteLength(payload), 0);
	buffer.write(payload, 4);
	process.stdout.write(buffer);
}

function runNpxCommand(args: string[]): Promise<{ stdout: string; stderr: string }> {
	return new Promise((resolve) => {
		execFile("npx", ["skills", ...args], { timeout: 30000 }, (_error, stdout, stderr) => {
			resolve({ stdout, stderr });
		});
	});
}

async function main() {
	while (true) {
		const msg = await readMessage();
		if (!msg) break;

		const message = msg as Record<string, string>;
		const command = message.command;
		const query = message.query;
		const packageName = message.package;
		const name = message.name;

		let result: { stdout: string; stderr: string };

		try {
			switch (command) {
				case "find":
					result = await runNpxCommand(query ? [query] : []);
					sendMessage({ success: true, command: "find", output: result.stdout, error: result.stderr });
					break;
				case "list":
					result = await runNpxCommand(["list", "--json", "--global"]);
					try {
						const parsed = JSON.parse(result.stdout);
						sendMessage({ success: true, command: "list", skills: parsed });
					} catch {
						sendMessage({ success: true, command: "list", raw: result.stdout });
					}
					break;
				case "add":
					if (!packageName) {
						sendMessage({ success: false, error: "Missing 'package' parameter" });
						break;
					}
					result = await runNpxCommand([packageName, "-g", "-y"]);
					sendMessage({ success: !result.stderr.includes("error"), output: result.stdout, error: result.stderr });
					break;
				case "remove":
					if (!name) {
						sendMessage({ success: false, error: "Missing 'name' parameter" });
						break;
					}
					result = await runNpxCommand([name, "-g", "-y"]);
					sendMessage({ success: !result.stderr.includes("error"), output: result.stdout, error: result.stderr });
					break;
				default:
					sendMessage({ success: false, error: `Unknown command: ${command}` });
			}
		} catch (err: unknown) {
			const msg = err instanceof Error ? err.message : String(err);
			sendMessage({ success: false, error: msg });
		}
	}
}

main();
