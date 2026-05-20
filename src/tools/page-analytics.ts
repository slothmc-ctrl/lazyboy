import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export function createPageAnalyticsTool(): AgentTool {
	return {
		name: "page_analytics",
		label: "Page Analytics",
		description: "Analyze the current page structure and return insights",
		parameters: Type.Object({
			analyze: Type.Optional(
				Type.Enum({ headings: "headings", links: "links", meta: "meta", structure: "structure", all: "all" }),
			),
		}),
		execute: async (_toolCallId, params) => {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				return { content: [{ type: "text" as const, text: "No active tab" }], details: {} };
			}

			if (tab.url?.startsWith("chrome://") || tab.url?.startsWith("chrome-extension://")) {
				return { content: [{ type: "text" as const, text: "Cannot analyze browser internal pages" }], details: {} };
			}

			const scope = (params as { analyze?: "headings" | "links" | "meta" | "structure" | "all" }).analyze || "all";
			const results: Record<string, unknown> = {};

			if (scope === "headings" || scope === "all") {
				results.headings = await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					func: () => {
						const headings = [...document.querySelectorAll("h1,h2,h3,h4,h5,h6")] as HTMLElement[];
						return headings.map((h) => ({ level: h.tagName, text: h.textContent?.trim() || "" }));
					},
				});
			}

			if (scope === "links" || scope === "all") {
				results.links = await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					func: () => {
						const links = [...document.querySelectorAll("a[href]")] as HTMLAnchorElement[];
						const origin = window.location.origin;
						return {
							total: links.length,
							internal: links.filter((l) => l.href.startsWith(origin)).length,
							external: links.filter((l) => !l.href.startsWith(origin)).length,
						};
					},
				});
			}

			if (scope === "meta" || scope === "all") {
				results.meta = await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					func: () => {
						const ogTags = [...document.querySelectorAll("meta[property^='og:']")] as HTMLMetaElement[];
						return {
							title: document.title,
							description: document.querySelector("meta[name='description']")?.getAttribute("content"),
							og: ogTags.map((m) => ({ property: m.getAttribute("property"), content: m.content })),
						};
					},
				});
			}

			if (scope === "structure" || scope === "all") {
				results.structure = await chrome.scripting.executeScript({
					target: { tabId: tab.id },
					func: () => {
						const tags = ["nav", "main", "article", "section", "aside", "footer", "header"];
						return tags.map((t) => ({ tag: t, count: document.querySelectorAll(t).length }));
					},
				});
			}

			return { content: [{ type: "text", text: JSON.stringify(results) }], details: { results } };
		},
	};
}
