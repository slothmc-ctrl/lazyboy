import { beforeEach, describe, expect, it, vi } from "vitest";
import { createScreenshotTool } from "../screenshot.js";

// Mock chrome API
const mockTabs = {
	query: vi.fn(),
	captureVisibleTab: vi.fn(),
};

(globalThis as any).chrome = {
	tabs: mockTabs,
};

describe("screenshot", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createScreenshotTool", () => {
		it("should return a valid AgentTool with correct name and label", () => {
			const tool = createScreenshotTool();
			expect(tool.name).toBe("screenshot");
			expect(tool.label).toBe("Screenshot");
			expect(tool.description).toBeDefined();
		});

		it("should have parameters with optional format and quality fields", () => {
			const tool = createScreenshotTool();
			expect(tool.parameters).toBeDefined();
		});

		it("should have an execute function", () => {
			const tool = createScreenshotTool();
			expect(typeof tool.execute).toBe("function");
		});

		it("should return error when no active tab", async () => {
			const tool = createScreenshotTool();
			mockTabs.query.mockResolvedValueOnce([]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should return error when tab has no id", async () => {
			const tool = createScreenshotTool();
			mockTabs.query.mockResolvedValueOnce([{ id: null }]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should capture screenshot with default format (png)", async () => {
			const tool = createScreenshotTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, windowId: 2, title: "Test Page" }]);
			mockTabs.captureVisibleTab.mockResolvedValueOnce("data:image/png;base64,AAAA");

			const result = await tool.execute("id1", {});
			expect(mockTabs.captureVisibleTab).toHaveBeenCalledWith(2, {
				format: "png",
				quality: 90,
			});
			expect((result.content[0] as { type: "text"; text: string }).text).toContain("Screenshot captured:");
			expect(result.details.tabId).toBe(1);
			expect(result.details.tabTitle).toBe("Test Page");
		});

		it("should capture screenshot with jpeg format", async () => {
			const tool = createScreenshotTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, windowId: 2, title: "Test Page" }]);
			mockTabs.captureVisibleTab.mockResolvedValueOnce("data:image/jpeg;base64,AAAA");

			const result = await tool.execute("id1", {
				format: "jpeg",
				quality: 50,
			});
			expect(mockTabs.captureVisibleTab).toHaveBeenCalledWith(2, {
				format: "jpeg",
				quality: 50,
			});
		});

		it("should include tabId and tabTitle in details", async () => {
			const tool = createScreenshotTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 42, windowId: 7, title: "My Page" }]);
			mockTabs.captureVisibleTab.mockResolvedValueOnce("data:image/png;base64,AAAA");

			const result = await tool.execute("id1", {});
			expect(result.details.tabId).toBe(42);
			expect(result.details.tabTitle).toBe("My Page");
			expect(result.details.dataUrl).toBe("data:image/png;base64,AAAA");
		});
	});
});
