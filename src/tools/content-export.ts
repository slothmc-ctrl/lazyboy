import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

type ExportParams = { format: "markdown" | "text"; includeSelectors?: string; excludeSelectors?: string };

export function createContentExportTool(): AgentTool {
	return {
		name: "export_content",
		label: "Export Content",
		description: "Extract page content in structured format",
		parameters: Type.Object({
			format: Type.Enum({ markdown: "markdown", text: "text" }),
			includeSelectors: Type.Optional(Type.String({ description: "CSS selector for content to include" })),
			excludeSelectors: Type.Optional(Type.String({ description: "CSS selector for content to exclude" })),
		}),
		execute: async (_toolCallId, params) => {
			const p = params as ExportParams;
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				return { content: [{ type: "text" as const, text: "No active tab" }], details: {} };
			}

			if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
				return { content: [{ type: "text" as const, text: "Cannot export browser internal pages" }], details: {} };
			}

			const result = await chrome.scripting.executeScript({
				target: { tabId: tab.id },
				func: (format: string, includeSelectors: string | undefined, excludeSelectors: string | undefined) => {
					let root: HTMLElement | null = document.body;
					if (includeSelectors) {
						const el = document.querySelector(includeSelectors);
						if (el instanceof HTMLElement) root = el;
					}
					if (!root) return { content: "" };

					if (excludeSelectors) {
						excludeSelectors.split(",").forEach((sel) => {
							root!.querySelectorAll(sel.trim()).forEach((el) => {
								el.remove();
							});
						});
					}

					if (format === "text") {
						return { content: root.innerText };
					}

					const md = domToMarkdown(root);
					return { content: md };
				},
				args: [p.format, p.includeSelectors, p.excludeSelectors],
			});

			if (result[0]?.result?.content) {
				return {
					content: [{ type: "text", text: result[0].result.content }],
					details: { format: p.format, title: tab.title },
				};
			}
			return { content: [{ type: "text", text: "No content extracted" }], details: {} };
		},
	};
}

function domToMarkdown(root: Element): string {
	const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT);
	let md = "";
	let node: Node | null = null;

	while (true) {
		node = walker.nextNode();
		if (!node) break;
		if (node instanceof HTMLElement) {
			const tag = node.tagName.toLowerCase();
			const text = node.textContent?.trim() || "";
			if (!text) continue;

			switch (tag) {
				case "h1":
					md += `\n# ${text}\n`;
					break;
				case "h2":
					md += `\n## ${text}\n`;
					break;
				case "h3":
					md += `\n### ${text}\n`;
					break;
				case "h4":
					md += `\n#### ${text}\n`;
					break;
				case "h5":
					md += `\n##### ${text}\n`;
					break;
				case "h6":
					md += `\n###### ${text}\n`;
					break;
				case "p":
					md += `\n${text}\n`;
					break;
				case "li":
					md += `- ${text}\n`;
					break;
				case "blockquote":
					md += `\n> ${text}\n`;
					break;
				case "code":
					md += `\`${text}\``;
					break;
				case "pre":
					md += `\n\`\`\`\n${text}\n\`\`\`\n`;
					break;
				case "a": {
					const href = node.getAttribute("href") || "";
					md += `[${text}](${href})`;
					break;
				}
				case "img": {
					const alt = node.getAttribute("alt") || "";
					const src = node.getAttribute("src") || "";
					md += `![${alt}](${src})`;
					break;
				}
				case "hr":
					md += "\n---\n";
					break;
				case "strong":
				case "b":
					md += `**${text}**`;
					break;
				case "em":
				case "i":
					md += `*${text}*`;
					break;
			}
		}
	}

	return md;
}
