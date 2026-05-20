import { beforeEach, describe, expect, it, vi } from "vitest";
import { createContentExportTool } from "../content-export.js";

// Mock chrome API
const mockTabs = {
	query: vi.fn(),
};

const mockScripting = {
	executeScript: vi.fn(),
};

(globalThis as any).chrome = {
	tabs: mockTabs,
	scripting: mockScripting,
};

describe("content-export", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createContentExportTool", () => {
		it("should return a valid AgentTool with correct name and label", () => {
			const tool = createContentExportTool();
			expect(tool.name).toBe("export_content");
			expect(tool.label).toBe("Export Content");
			expect(tool.description).toBeDefined();
		});

		it("should have parameters with format, includeSelectors, excludeSelectors", () => {
			const tool = createContentExportTool();
			expect(tool.parameters).toBeDefined();
		});

		it("should have an execute function", () => {
			const tool = createContentExportTool();
			expect(typeof tool.execute).toBe("function");
		});

		it("should return error when no active tab", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should return error when tab has no id", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: null }]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should return error for chrome:// pages", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, url: "chrome://extensions/" }]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe(
				"Cannot export browser internal pages",
			);
		});

		it("should return error for chrome-extension:// pages", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, url: "chrome-extension://abc123/popup.html" }]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe(
				"Cannot export browser internal pages",
			);
		});

		it("should execute script with correct args for markdown format", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com", title: "Example" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: { content: "# Hello\n\nWorld" } }]);

			const result = await tool.execute("id1", {
				format: "markdown",
			});
			expect(mockScripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 5 },
				func: expect.any(Function),
				args: ["markdown", undefined, undefined],
			});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("# Hello\n\nWorld");
			expect(result.details.format).toBe("markdown");
			expect(result.details.title).toBe("Example");
		});

		it("should execute script with correct args for text format", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com", title: "Example" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: { content: "Plain text content" } }]);

			const result = await tool.execute("id1", {
				format: "text",
			});
			expect(mockScripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 5 },
				func: expect.any(Function),
				args: ["text", undefined, undefined],
			});
		});

		it("should pass includeSelectors and excludeSelectors as args", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com", title: "Example" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: { content: "Filtered content" } }]);

			await tool.execute("id1", {
				format: "markdown",
				includeSelectors: "main",
				excludeSelectors: "nav,footer",
			});
			expect(mockScripting.executeScript).toHaveBeenCalledWith({
				target: { tabId: 5 },
				func: expect.any(Function),
				args: ["markdown", "main", "nav,footer"],
			});
		});

		it("should return 'No content extracted' when script returns empty result", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com", title: "Example" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: { content: "" } }]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No content extracted");
		});

		it("should return 'No content extracted' when result array is empty", async () => {
			const tool = createContentExportTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com", title: "Example" }]);
			mockScripting.executeScript.mockResolvedValueOnce([]);

			const result = await tool.execute("id1", { format: "text" });
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No content extracted");
		});
	});
});
