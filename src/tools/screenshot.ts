import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

export function createScreenshotTool(): AgentTool {
	return {
		name: "screenshot",
		label: "Screenshot",
		description: "Capture a screenshot of the current tab's visible area",
		parameters: Type.Object({
			format: Type.Optional(Type.Enum({ png: "png", jpeg: "jpeg" })),
			quality: Type.Optional(Type.Number({ minimum: 0, maximum: 100, description: "JPEG quality (0-100)" })),
		}),
		execute: async (_toolCallId, params) => {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				return { content: [{ type: "text" as const, text: "No active tab" }], details: {} };
			}

			const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
				format: (params as { format?: "png" | "jpeg"; quality?: number }).format || "png",
				quality: (params as { format?: "png" | "jpeg"; quality?: number }).quality || 90,
			});

			return {
				content: [{ type: "text", text: `Screenshot captured: ${dataUrl.substring(0, 100)}...` }],
				details: { dataUrl, tabId: tab.id, tabTitle: tab.title },
			};
		},
	};
}
