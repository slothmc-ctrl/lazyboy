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
		execute: async (params) => {
			const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
			if (!tab?.id) {
				return { success: false, error: "No active tab" };
			}

			const dataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, {
				format: params.format || "png",
				quality: params.quality || 90,
			});

			return { success: true, dataUrl, tabId: tab.id, tabTitle: tab.title };
		},
	};
}
