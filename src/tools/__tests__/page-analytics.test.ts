import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPageAnalyticsTool } from "../page-analytics.js";

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

describe("page-analytics", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	describe("createPageAnalyticsTool", () => {
		it("should return a valid AgentTool with correct name and label", () => {
			const tool = createPageAnalyticsTool();
			expect(tool.name).toBe("page_analytics");
			expect(tool.label).toBe("Page Analytics");
			expect(tool.description).toBeDefined();
		});

		it("should have parameters with optional analyze field", () => {
			const tool = createPageAnalyticsTool();
			expect(tool.parameters).toBeDefined();
		});

		it("should have an execute function", () => {
			const tool = createPageAnalyticsTool();
			expect(typeof tool.execute).toBe("function");
		});

		it("should return error when no active tab", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should return error when tab has no id", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: null }]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe("No active tab");
		});

		it("should return error for chrome:// pages", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, url: "chrome://extensions/" }]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe(
				"Cannot analyze browser internal pages",
			);
		});

		it("should return error for chrome-extension:// pages", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 1, url: "chrome-extension://abc123/popup.html" }]);

			const result = await tool.execute("id1", {});
			expect((result.content[0] as { type: "text"; text: string }).text).toBe(
				"Cannot analyze browser internal pages",
			);
		});

		it("should default analyze to 'all' when no scope provided", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			// Mock 4 executeScript calls: headings, links, meta, structure
			mockScripting.executeScript
				.mockResolvedValueOnce([{ result: [{ level: "H1", text: "Title" }] }])
				.mockResolvedValueOnce([{ result: { total: 10, internal: 5, external: 5 } }])
				.mockResolvedValueOnce([{ result: { title: "My Site", description: "desc", og: [] } }])
				.mockResolvedValueOnce([{ result: [{ tag: "nav", count: 1 }] }]);

			const result = await tool.execute("id1", {});
			expect(mockScripting.executeScript).toHaveBeenCalledTimes(4);
			expect((result.content[0] as { type: "text"; text: string }).text).toContain("headings");
			expect((result.content[0] as { type: "text"; text: string }).text).toContain("links");
			expect((result.content[0] as { type: "text"; text: string }).text).toContain("meta");
			expect((result.content[0] as { type: "text"; text: string }).text).toContain("structure");
		});

		it("should only run headings analysis when scope is 'headings'", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: [{ level: "H1", text: "Title" }] }]);

			await tool.execute("id1", { analyze: "headings" });
			expect(mockScripting.executeScript).toHaveBeenCalledTimes(1);
		});

		it("should only run links analysis when scope is 'links'", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: { total: 10, internal: 5, external: 5 } }]);

			await tool.execute("id1", { analyze: "links" });
			expect(mockScripting.executeScript).toHaveBeenCalledTimes(1);
		});

		it("should only run meta analysis when scope is 'meta'", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			mockScripting.executeScript.mockResolvedValueOnce([
				{ result: { title: "My Site", description: "desc", og: [] } },
			]);

			await tool.execute("id1", { analyze: "meta" });
			expect(mockScripting.executeScript).toHaveBeenCalledTimes(1);
		});

		it("should only run structure analysis when scope is 'structure'", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: [{ tag: "nav", count: 1 }] }]);

			await tool.execute("id1", { analyze: "structure" });
			expect(mockScripting.executeScript).toHaveBeenCalledTimes(1);
		});

		it("should return details with results object", async () => {
			const tool = createPageAnalyticsTool();
			mockTabs.query.mockResolvedValueOnce([{ id: 5, url: "https://example.com" }]);
			mockScripting.executeScript.mockResolvedValueOnce([{ result: [{ level: "H1", text: "Title" }] }]);

			const result = await tool.execute("id1", { analyze: "headings" });
			expect(result.details).toHaveProperty("results");
		});
	});
});
