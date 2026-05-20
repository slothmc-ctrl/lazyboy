import {
	AppStorage as BaseAppStorage,
	CustomProvidersStore,
	getAppStorage,
	IndexedDBStorageBackend,
	ProviderKeysStore,
	SessionsStore,
	SettingsStore,
} from "@mariozechner/pi-web-ui";
import { CostStore } from "./stores/cost-store.js";
import { LazyboySessionsStore } from "./stores/sessions-store.js";
import { SkillsStore } from "./stores/skills-store.js";

/**
 * Extended AppStorage for Lazyboy with skills, memories, and prompts stores.
 * Previously "sitegeist-storage" — old DB is orphaned on first run with new name.
 */
export class LazyboyAppStorage extends BaseAppStorage {
	readonly skills: SkillsStore;
	readonly costs: CostStore;

	constructor() {
		// 1. Create all stores (no backend yet)
		const settings = new SettingsStore();
		const providerKeys = new ProviderKeysStore();
		const sessions = new LazyboySessionsStore();
		const customProviders = new CustomProvidersStore();
		const skills = new SkillsStore();
		const costs = new CostStore();

		// 2. Gather configs from all stores
		const configs = [
			settings.getConfig(),
			SessionsStore.getMetadataConfig(),
			providerKeys.getConfig(),
			customProviders.getConfig(),
			sessions.getConfig(),
			skills.getConfig(),
			costs.getConfig(),
		];

		// 3. Create backend with all configs
		const backend = new IndexedDBStorageBackend({
			dbName: "lazyboy-storage",
			version: 3, // Increment version to add custom-providers store
			stores: configs,
		});

		// 4. Wire backend to all stores
		settings.setBackend(backend);
		providerKeys.setBackend(backend);
		customProviders.setBackend(backend);
		sessions.setBackend(backend);
		skills.setBackend(backend);
		costs.setBackend(backend);

		// 5. Pass base stores to parent
		super(settings, providerKeys, sessions, customProviders, backend);

		// 6. Store references to lazyboy-specific stores
		this.skills = skills;
		this.costs = costs;
	}
}

/**
 * Helper to get typed Lazyboy storage.
 */
export function getLazyboyStorage(): LazyboyAppStorage {
	return getAppStorage() as LazyboyAppStorage;
}
