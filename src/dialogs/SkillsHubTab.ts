import { DialogTab } from "@mariozechner/pi-web-ui";
import { html } from "lit";
import { customElement, state } from "lit/decorators.js";
import {
	fetchAvailableSkills,
	getSkillsHubState,
	installSkill,
	refreshInstalled,
	uninstallSkill,
} from "../tools/skills-hub.js";

@customElement("lazyboy-skills-hub-tab")
export class SkillsHubTab extends DialogTab {
	@state() private filter = "";
	@state() private loading = false;
	@state() private error: string | null = null;

	constructor() {
		super("Skills Hub");
	}

	override connectedCallback() {
		super.connectedCallback();
		this.loadData();
	}

	private async loadData() {
		this.loading = true;
		this.error = null;
		await refreshInstalled();
		await fetchAvailableSkills();
		this.loading = false;
		this.requestUpdate();
	}

	private async handleInstall(skillName: string) {
		await installSkill(skillName);
		this.requestUpdate();
	}

	private async handleUninstall(skillName: string) {
		await uninstallSkill(skillName);
		this.requestUpdate();
	}

	private handleFilterChange(e: Event) {
		this.filter = (e.target as HTMLInputElement).value.toLowerCase();
	}

	renderContent() {
		const state = getSkillsHubState();

		if (this.loading) {
			return html`<div class="flex items-center justify-center py-8 text-muted-foreground">Loading skills...</div>`;
		}

		if (this.error) {
			return html`
				<div class="flex flex-col items-center justify-center py-8 text-center">
					<p class="text-sm text-destructive mb-2">${this.error}</p>
					<p class="text-xs text-muted-foreground mb-4">Run <code class="px-1 py-0.5 bg-muted rounded">scripts/install-bridge.sh</code> to set up the skills bridge.</p>
					<button class="px-3 py-1.5 text-sm bg-primary text-primary-foreground rounded hover:bg-primary/90" @click=${() => this.loadData()}>Retry</button>
				</div>
			`;
		}

		const filteredAvailable = state.available.filter(
			(s) =>
				!this.filter ||
				s.name.toLowerCase().includes(this.filter) ||
				s.description.toLowerCase().includes(this.filter),
		);

		const filteredInstalled = state.installed.filter(
			(s) => !this.filter || s.name.toLowerCase().includes(this.filter),
		);

		return html`
			<div class="flex flex-col gap-4 py-2">
				<div class="flex items-center gap-2">
					<input
						type="text"
						placeholder="Filter skills..."
						class="flex-1 px-3 py-1.5 text-sm border border-border rounded bg-background focus:outline-none focus:border-primary"
						value=${this.filter}
						@input=${this.handleFilterChange}
					/>
					<button class="px-3 py-1.5 text-sm border border-border rounded hover:bg-secondary" @click=${() => this.loadData()}>Refresh</button>
				</div>

				<div>
					<h3 class="text-sm font-medium mb-2">Available Skills (${filteredAvailable.length})</h3>
					<div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
						${
							filteredAvailable.length === 0
								? html`<p class="text-xs text-muted-foreground py-2">No skills found.</p>`
								: filteredAvailable.map(
										(s) => html`
										<div class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-secondary/50">
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">${s.name}</p>
												<p class="text-xs text-muted-foreground truncate">${s.description}</p>
											</div>
											<span class="text-[10px] text-muted-foreground mr-2">${s.installCount || 0} installs</span>
											<button
												class="px-2 py-1 text-xs bg-primary text-primary-foreground rounded hover:bg-primary/90"
												@click=${() => this.handleInstall(s.name)}
											>Install</button>
										</div>
									`,
									)
						}
					</div>
				</div>

				<div>
					<h3 class="text-sm font-medium mb-2">Installed Skills (${filteredInstalled.length})</h3>
					<div class="flex flex-col gap-1 max-h-48 overflow-y-auto">
						${
							filteredInstalled.length === 0
								? html`<p class="text-xs text-muted-foreground py-2">No skills installed.</p>`
								: filteredInstalled.map(
										(s) => html`
										<div class="flex items-center justify-between px-2 py-1.5 rounded hover:bg-secondary/50">
											<div class="flex-1 min-w-0">
												<p class="text-sm font-medium truncate">${s.name}</p>
											</div>
											<button
												class="px-2 py-1 text-xs border border-border rounded hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
												@click=${() => this.handleUninstall(s.name)}
											>Uninstall</button>
										</div>
									`,
									)
						}
					</div>
				</div>
			</div>
		`;
	}
}
