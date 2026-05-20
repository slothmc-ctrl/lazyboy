import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVoiceTool, isVoiceListening, startVoiceInput, stopVoiceInput } from "../voice.js";

// Provide a global window mock for the node environment
(globalThis as any).window = globalThis;

// Mock the SpeechRecognition API
class MockSpeechRecognition {
	continuous = false;
	interimResults = false;
	lang = "";
	onresult: ((event: SpeechRecognitionEvent) => void) | null = null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null = null;
	onend: (() => void) | null = null;
	start = vi.fn();
	stop = vi.fn();
}

function createMockSpeechEvent(results: { transcript: string; isFinal: boolean }[]): SpeechRecognitionEvent {
	return {
		resultIndex: 0,
		results: results.map((r, i) => ({
			[i]: {
				transcript: r.transcript,
				confidence: 1,
			},
			length: 1,
			isFinal: r.isFinal,
		})),
		interpretation: null,
		emma: null,
	} as unknown as SpeechRecognitionEvent;
}

function createMockErrorEvent(error: string): SpeechRecognitionErrorEvent {
	return { error, message: error } as SpeechRecognitionErrorEvent;
}

describe("voice", () => {
	beforeEach(() => {
		// Reset module-level state
		stopVoiceInput();
		vi.restoreAllMocks();

		// Set up mock SpeechRecognition
		const mockRecognition = new MockSpeechRecognition();
		(globalThis.window as any).SpeechRecognition = vi.fn(() => mockRecognition);
		(globalThis.window as any).webkitSpeechRecognition = undefined;
	});

	afterEach(() => {
		stopVoiceInput();
	});

	describe("startVoiceInput", () => {
		it("should call onError when SpeechRecognition is not supported", () => {
			delete (globalThis.window as any).SpeechRecognition;
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			expect(onError).toHaveBeenCalledWith("Speech recognition not supported in this browser");
		});

		it("should use webkitSpeechRecognition as fallback", () => {
			delete (globalThis.window as any).SpeechRecognition;
			const mockRecognition = new MockSpeechRecognition();
			(globalThis.window as any).webkitSpeechRecognition = vi.fn(() => mockRecognition);

			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			expect(onError).not.toHaveBeenCalled();
		});

		it("should stop and restart if already listening", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			startVoiceInput(onResult, onError, onEnd);

			// Second call should have stopped the first
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;
			expect(rec.stop).toHaveBeenCalledTimes(1);
		});

		it("should use default language when none provided", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			Object.defineProperty(navigator, "language", {
				value: "en-US",
				configurable: true,
			});

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;
			expect(rec.lang).toBe("en-US");
		});

		it("should use provided language", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd, "de-DE");
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;
			expect(rec.lang).toBe("de-DE");
		});

		it("should call onResult with transcript on speech result", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;

			const event = createMockSpeechEvent([{ transcript: "hello", isFinal: false }]);
			rec.onresult!(event);

			expect(onResult).toHaveBeenCalledWith({
				text: "hello",
				isFinal: false,
			});
		});

		it("should call onResult with final transcript", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;

			const event = createMockSpeechEvent([{ transcript: "hello world", isFinal: true }]);
			rec.onresult!(event);

			expect(onResult).toHaveBeenCalledWith({
				text: "hello world",
				isFinal: true,
			});
		});

		it("should call onError when permission denied", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;

			rec.onerror!(createMockErrorEvent("not-allowed"));
			expect(onError).toHaveBeenCalledWith("Microphone permission denied");
		});

		it("should call onError when no speech detected", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;

			rec.onerror!(createMockErrorEvent("no-speech"));
			expect(onError).toHaveBeenCalledWith("No speech detected");
		});

		it("should call onError with generic message for other errors", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;

			rec.onerror!(createMockErrorEvent("aborted"));
			expect(onError).toHaveBeenCalledWith("Speech error: aborted");
		});

		it("should handle start() throwing an error", () => {
			const mockRecognition = new MockSpeechRecognition();
			mockRecognition.start = vi.fn(() => {
				throw new Error("start failed");
			});
			(globalThis.window as any).SpeechRecognition = vi.fn(() => mockRecognition);

			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			expect(onError).toHaveBeenCalledWith("Failed to start speech recognition");
		});

		it("should call onEnd when recognition ends", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;
			rec.onend!();

			expect(onEnd).toHaveBeenCalled();
			expect(isVoiceListening()).toBe(false);
		});
	});

	describe("stopVoiceInput", () => {
		it("should stop recognition and reset state", () => {
			const onError = vi.fn();
			const onResult = vi.fn();
			const onEnd = vi.fn();

			startVoiceInput(onResult, onError, onEnd);
			expect(isVoiceListening()).toBe(true);

			const rec = (globalThis.window as any).SpeechRecognition.mock.results[0].value;
			stopVoiceInput();

			expect(rec.stop).toHaveBeenCalled();
			expect(isVoiceListening()).toBe(false);
		});

		it("should be safe to call when not listening", () => {
			expect(() => stopVoiceInput()).not.toThrow();
		});
	});

	describe("createVoiceTool", () => {
		it("should return a valid AgentTool with correct name and label", () => {
			const tool = createVoiceTool();
			expect(tool.name).toBe("voice_input");
			expect(tool.label).toBe("Voice Input");
			expect(tool.description).toBeDefined();
		});

		it("should have parameters with optional lang field", () => {
			const tool = createVoiceTool();
			expect(tool.parameters).toBeDefined();
		});

		it("should have an execute function", () => {
			const tool = createVoiceTool();
			expect(typeof tool.execute).toBe("function");
		});
	});
});
