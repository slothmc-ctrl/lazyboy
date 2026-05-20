export interface SkillEntry {
	name: string;
	description: string;
	installCount?: number;
	installed: boolean;
}

export interface SkillsHubState {
	available: SkillEntry[];
	installed: SkillEntry[];
	loading: boolean;
	error: string | null;
	lastFetch: number | null;
}

const cachedState: SkillsHubState = {
	available: [],
	installed: [],
	loading: false,
	error: null,
	lastFetch: null,
};

export function getSkillsHubState(): SkillsHubState {
	return cachedState;
}

export async function fetchAvailableSkills(_query?: string): Promise<SkillEntry[]> {
	cachedState.loading = false;
	// Native messaging host (scripts/skills-bridge.ts) handles skill commands externally.
	// The extension service worker cannot run Node.js child_process.
	cachedState.error = "Skills bridge not available in extension context";
	return [];
}

export async function listInstalledSkills(): Promise<SkillEntry[]> {
	// Native messaging host (scripts/skills-bridge.ts) handles skill commands externally.
	// The extension service worker cannot run Node.js child_process.
	return [];
}

export async function installSkill(_packageName: string): Promise<boolean> {
	// Native messaging host (scripts/skills-bridge.ts) handles skill commands externally.
	// The extension service worker cannot run Node.js child_process.
	return false;
}

export async function uninstallSkill(_name: string): Promise<boolean> {
	// Native messaging host (scripts/skills-bridge.ts) handles skill commands externally.
	// The extension service worker cannot run Node.js child_process.
	return false;
}

export async function refreshInstalled(): Promise<void> {
	const installed = await listInstalledSkills();
	cachedState.installed = installed;
}
