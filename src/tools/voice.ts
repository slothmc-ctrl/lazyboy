import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

interface VoiceResult {
	text: string;
	isFinal: boolean;
}

// SpeechRecognition is not in the DOM lib for this target
interface SpeechRecognitionInstance {
	continuous: boolean;
	interimResults: boolean;
	lang: string;
	onresult: ((event: SpeechRecognitionEvent) => void) | null;
	onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
	onend: (() => void) | null;
	start(): void;
	stop(): void;
}

let recognition: SpeechRecognitionInstance | null = null;
let isListening = false;

export function startVoiceInput(
	onResult: (result: VoiceResult) => void,
	onError: (error: string) => void,
	onEnd: () => void,
	lang?: string,
): void {
	const SpeechRecognitionCtor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
	if (!SpeechRecognitionCtor) {
		onError("Speech recognition not supported in this browser");
		return;
	}

	if (isListening) {
		stopVoiceInput();
		return;
	}

	const rec: SpeechRecognitionInstance = new SpeechRecognitionCtor();
	rec.continuous = false;
	rec.interimResults = true;
	rec.lang = lang || navigator.language || "en-US";

	rec.onresult = (event: SpeechRecognitionEvent) => {
		let transcript = "";
		let isFinal = false;
		for (let i = event.resultIndex; i < event.results.length; i++) {
			transcript += event.results[i][0].transcript;
			if (event.results[i].isFinal) {
				isFinal = true;
			}
		}
		onResult({ text: transcript, isFinal });
	};

	rec.onerror = (event: SpeechRecognitionErrorEvent) => {
		if (event.error === "not-allowed") {
			onError("Microphone permission denied");
		} else if (event.error === "no-speech") {
			onError("No speech detected");
		} else {
			onError(`Speech error: ${event.error}`);
		}
		isListening = false;
	};

	rec.onend = () => {
		isListening = false;
		recognition = null;
		onEnd();
	};

	recognition = rec;
	try {
		rec.start();
		isListening = true;
	} catch (e) {
		onError("Failed to start speech recognition");
		isListening = false;
	}
}

export function stopVoiceInput(): void {
	if (recognition) {
		recognition.stop();
		recognition = null;
	}
	isListening = false;
}

export function isVoiceListening(): boolean {
	return isListening;
}

export function createVoiceTool(): AgentTool {
	return {
		name: "voice_input",
		label: "Voice Input",
		description: "Capture voice input from the user via microphone",
		parameters: Type.Object({
			lang: Type.Optional(Type.String({ description: "Language code (e.g., en-US, de-DE)" })),
		}),
		execute: async (_toolCallId, params, _signal) => {
			return new Promise<{ content: { type: "text"; text: string }[]; details: Record<string, unknown> }>(
				(resolve) => {
					let finalText = "";
					startVoiceInput(
						(result) => {
							finalText = result.text;
						},
						(error) => {
							resolve({ content: [{ type: "text", text: error }], details: {} });
						},
						() => {
							if (finalText) {
								resolve({ content: [{ type: "text", text: finalText }], details: { text: finalText } });
							} else {
								resolve({ content: [{ type: "text", text: "No speech captured" }], details: {} });
							}
						},
						(params as { lang?: string }).lang,
					);
				},
			);
		},
	};
}
