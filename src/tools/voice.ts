import type { AgentTool } from "@mariozechner/pi-agent-core";
import { Type } from "@sinclair/typebox";

declare global {
	interface Window {
		webkitSpeechRecognition: typeof SpeechRecognition;
	}
}

interface VoiceResult {
	text: string;
	isFinal: boolean;
}

let recognition: SpeechRecognition | null = null;
let isListening = false;

export function startVoiceInput(
	onResult: (result: VoiceResult) => void,
	onError: (error: string) => void,
	onEnd: () => void,
	lang?: string,
): void {
	const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
	if (!SpeechRecognition) {
		onError("Speech recognition not supported in this browser");
		return;
	}

	if (isListening) {
		stopVoiceInput();
		return;
	}

	recognition = new SpeechRecognition();
	recognition.continuous = false;
	recognition.interimResults = true;
	recognition.lang = lang || navigator.language || "en-US";

	recognition.onresult = (event: SpeechRecognitionEvent) => {
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

	recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
		if (event.error === "not-allowed") {
			onError("Microphone permission denied");
		} else if (event.error === "no-speech") {
			onError("No speech detected");
		} else {
			onError(`Speech error: ${event.error}`);
		}
		isListening = false;
	};

	recognition.onend = () => {
		isListening = false;
		recognition = null;
		onEnd();
	};

	try {
		recognition.start();
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
		execute: async (params, _signal) => {
			return new Promise((resolve) => {
				let finalText = "";
				startVoiceInput(
					(result) => {
						finalText = result.text;
					},
					(error) => {
						resolve({ success: false, error });
					},
					() => {
						if (finalText) {
							resolve({ success: true, text: finalText });
						} else {
							resolve({ success: false, error: "No speech captured" });
						}
					},
					params.lang,
				);
			});
		},
	};
}
