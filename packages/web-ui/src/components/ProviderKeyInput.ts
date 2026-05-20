import { i18n } from "@mariozechner/mini-lit";
import { Badge } from "@mariozechner/mini-lit/dist/Badge.js";
import { Button } from "@mariozechner/mini-lit/dist/Button.js";
import { type Context, complete, getModel } from "@mariozechner/pi-ai";
import { html, LitElement } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { getAppStorage } from "../storage/app-storage.js";
import { applyProxyIfNeeded } from "../utils/proxy-utils.js";
import { Input } from "./Input.js";

// Test models for each provider
const TEST_MODELS: Record<string, string> = {
	anthropic: "claude-haiku-4-5",
	openai: "gpt-4o-mini",
	google: "gemini-2.5-flash",
	groq: "openai/gpt-oss-20b",
	openrouter: "z-ai/glm-4.6",
	"vercel-ai-gateway": "anthropic/claude-opus-4.5",
	cerebras: "gpt-oss-120b",
	xai: "grok-4-fast-non-reasoning",
	zai: "glm-4.5-air",
};

@customElement("provider-key-input")
export class ProviderKeyInput extends LitElement {
	@property() provider = "";
	@state() private keyInput = "";
	@state() private testing = false;
	@state() private failed = false;
	@state() private errorMessage = "";
	@state() private hasKey = false;
	@state() private inputChanged = false;

	protected createRenderRoot() {
		return this;
	}

	override async connectedCallback() {
		super.connectedCallback();
		await this.checkKeyStatus();
	}

	private async checkKeyStatus() {
		try {
			const key = await getAppStorage().providerKeys.get(this.provider);
			this.hasKey = !!key;
		} catch (error) {
			console.error("Failed to check key status:", error);
		}
	}

	private async testApiKey(
		provider: string,
		apiKey: string,
	): Promise<{ success: boolean; error?: string }> {
		try {
			const modelId = TEST_MODELS[provider];
			// Returning true here for Ollama and friends. Can't know which model to use for testing
			if (!modelId) return { success: true };

			let model = getModel(provider as any, modelId);
			if (!model) return { success: false, error: `Unknown test model: ${modelId}` };

			// Get proxy URL from settings (if available)
			const proxyEnabled = await getAppStorage().settings.get<boolean>("proxy.enabled");
			const proxyUrl = await getAppStorage().settings.get<string>("proxy.url");

			// Apply proxy only if this provider/key combination requires it
			model = applyProxyIfNeeded(model, apiKey, proxyEnabled ? proxyUrl || undefined : undefined);

			const context: Context = {
				messages: [{ role: "user", content: "Reply with: ok", timestamp: Date.now() }],
			};

			const result = await complete(model, context, {
				apiKey,
				maxTokens: 200,
			} as any);

			if (result.stopReason === "stop") return { success: true };

			// Surface the actual error from the API response
			const detail = result.errorMessage || `Unexpected stop reason: ${result.stopReason}`;
			return { success: false, error: detail };
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			console.error(`API key test failed for ${provider}:`, error);
			return { success: false, error: message };
		}
	}

	private async saveKey() {
		if (!this.keyInput) return;

		this.testing = true;
		this.failed = false;
		this.errorMessage = "";

		const result = await this.testApiKey(this.provider, this.keyInput);

		this.testing = false;

		if (result.success) {
			try {
				await getAppStorage().providerKeys.set(this.provider, this.keyInput);
				this.hasKey = true;
				this.inputChanged = false;
				this.errorMessage = "";
				this.requestUpdate();
			} catch (error) {
				console.error("Failed to save API key:", error);
				this.failed = true;
				this.errorMessage = error instanceof Error ? error.message : "Failed to save";
				setTimeout(() => {
					this.failed = false;
					this.errorMessage = "";
					this.requestUpdate();
				}, 10000);
			}
		} else {
			this.failed = true;
			this.errorMessage = result.error || "";
			setTimeout(() => {
				this.failed = false;
				this.errorMessage = "";
				this.requestUpdate();
			}, 15000);
		}
	}

	render() {
		return html`
			<div class="space-y-3">
				<div class="flex items-center gap-2">
					<span class="text-sm font-medium capitalize text-foreground">${this.provider}</span>
					${
						this.testing
							? Badge({ children: i18n("Testing..."), variant: "secondary" })
							: this.hasKey
								? html`<span class="text-green-600 dark:text-green-400">✓</span>`
								: ""
					}
					${this.failed ? Badge({ children: this.errorMessage ? `✗ ${this.errorMessage.length > 120 ? this.errorMessage.slice(0, 120) + "…" : this.errorMessage}` : i18n("✗ Invalid"), variant: "destructive" }) : ""}
				</div>
				<div class="flex items-center gap-2">
					${Input({
						type: "password",
						placeholder: this.hasKey ? "••••••••••••" : i18n("Enter API key"),
						value: this.keyInput,
						onInput: (e: Event) => {
							this.keyInput = (e.target as HTMLInputElement).value;
							this.inputChanged = true;
							this.requestUpdate();
						},
						className: "flex-1",
					})}
					${Button({
						onClick: () => this.saveKey(),
						variant: "default",
						size: "sm",
						disabled: !this.keyInput || this.testing || (this.hasKey && !this.inputChanged),
						children: i18n("Save"),
					})}
				</div>
			</div>
		`;
	}
}
