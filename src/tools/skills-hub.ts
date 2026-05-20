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

export async function fetchAvailableSkills(query?: string): Promise<SkillEntry[]> {
	cachedState.loading = true;
	cachedState.error = null;

	try {
		const args = query ? ["find", query] : ["find"];
		const response = await chrome.runtime.sendMessage({
			type: "skills-bridge-command",
			command: "find",
			args,
		});

		if (response?.success && response.output) {
			const skills = parseSkillsOutput(response.output);
			cachedState.available = skills;
			cachedState.lastFetch = Date.now();
			return skills;
		}

		cachedState.error = response?.error || "Failed to fetch skills";
		return [];
	} catch (err) {
		cachedState.error = err instanceof Error ? err.message : "Bridge not available";
		return [];
	} finally {
		cachedState.loading = false;
	}
}

export async function listInstalledSkills(): Promise<SkillEntry[]> {
	try {
		const response = await chrome.runtime.sendMessage({
			type: "skills-bridge-command",
			command: "list",
			args: ["list", "--json", "--global"],
		});

		if (response?.success) {
			const skills = response.skills || [];
			return Array.isArray(skills)
				? skills.map((s: any) => ({ name: s.name || s, description: s.description || "", installed: true }))
				: [];
		}

		return [];
	} catch {
		return [];
	}
}

export async function installSkill(packageName: string): Promise<boolean> {
	try {
		const response = await chrome.runtime.sendMessage({
			type: "skills-bridge-command",
			command: "add",
			args: ["add", packageName, "-g", "-y"],
		});

		if (response?.success) {
			await refreshInstalled();
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

export async function uninstallSkill(name: string): Promise<boolean> {
	try {
		const response = await chrome.runtime.sendMessage({
			type: "skills-bridge-command",
			command: "remove",
			args: ["remove", name, "-g", "-y"],
		});

		if (response?.success) {
			await refreshInstalled();
			return true;
		}
		return false;
	} catch {
		return false;
	}
}

export async function refreshInstalled(): Promise<void> {
	const installed = await listInstalledSkills();
	cachedState.installed = installed;
}

function parseSkillsOutput(output: string): SkillEntry[] {
	const skills: SkillEntry[] = [];
	const lines = output.split("\n");

	for (const line of lines) {
		const match = line.match(/^[\s└]*([^\s@]+)@([^\s]+)\s+(\d+)\s+installs?/);
		if (match) {
			skills.push({
				name: `${match[1]}@${match[2]}`,
				description: match[1],
				installCount: parseInt(match[3], 10),
				installed: false,
			});
		}
	}

	return skills;
}
