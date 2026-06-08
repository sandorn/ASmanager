import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';

export function expandHome(input: string): string {
    if (input === '~') {
        return os.homedir();
    }

    if (input.startsWith('~/') || input.startsWith('~\\')) {
        return path.join(os.homedir(), input.slice(2));
    }

    return input;
}

export function getCentralRepository(): string {
    const configured = vscode.workspace
        .getConfiguration('agentSkillsManager')
        .get<string>('centralRepository', '~/.agents/skills');

    return path.resolve(expandHome(configured));
}

export function getConfiguredSources(): string[] {
    return vscode.workspace
        .getConfiguration('agentSkillsManager')
        .get<string[]>('sources', []);
}

export function formatBytes(bytes: number): string {
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const kilobytes = bytes / 1024;
    if (kilobytes < 1024) {
        return `${kilobytes.toFixed(1)} KB`;
    }

    return `${(kilobytes / 1024).toFixed(1)} MB`;
}
