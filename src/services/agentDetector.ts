import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { AgentInfo } from '../types/models';
import { localize, t } from './localization';

async function exists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

export class AgentDetector {
    async detect(): Promise<AgentInfo[]> {
        const home = os.homedir();
        const appData =
            process.env.APPDATA || path.join(home, 'AppData', 'Roaming');
        const userProfile = process.env.USERPROFILE || home;

        const candidates: Array<Omit<AgentInfo, 'detected' | 'detail'>> = [
            {
                id: 'claude-code',
                name: 'Claude Code',
                candidatePaths: [
                    path.join(home, '.claude'),
                    path.join(home, '.config', 'claude'),
                ],
                skillsSubPath: 'skills',
            },
            {
                id: 'codex',
                name: 'Codex',
                candidatePaths: [path.join(home, '.codex')],
                skillsSubPath: 'skills',
            },
            {
                id: 'opencode',
                name: 'OpenCode',
                candidatePaths: [path.join(home, '.config', 'opencode')],
                skillsSubPath: 'skills',
            },
            {
                id: 'cursor',
                name: 'Cursor',
                candidatePaths: [
                    path.join(userProfile, '.cursor'),
                    path.join(appData, 'Cursor'),
                ],
                skillsSubPath: 'skills',
            },
            {
                id: 'gemini-cli',
                name: 'Gemini CLI',
                candidatePaths: [path.join(home, '.gemini')],
                skillsSubPath: 'skills',
            },
            {
                id: 'copilot',
                name: 'Copilot',
                candidatePaths: [path.join(home, '.copilot')],
                skillsSubPath: 'skills',
            },
            {
                id: 'cline',
                name: 'Cline',
                candidatePaths: [path.join(home, '.cline')],
                skillsSubPath: 'skills',
            },
            {
                id: 'roo-code',
                name: 'Roo Code',
                candidatePaths: [path.join(home, '.roo')],
                skillsSubPath: 'skills',
            },
        ];

        const results: AgentInfo[] = [];
        for (const candidate of candidates) {
            const existingPath = await this.firstExistingPath(
                candidate.candidatePaths,
            );
            results.push({
                ...candidate,
                detected: Boolean(existingPath),
                detail: existingPath
                    ? localize(
                          `Detected at ${existingPath}`,
                          `检测位置：${existingPath}`,
                      )
                    : t('notDetected'),
            });
        }

        return results;
    }

    private async firstExistingPath(
        paths: string[],
    ): Promise<string | undefined> {
        for (const candidatePath of paths) {
            if (await exists(candidatePath)) {
                return candidatePath;
            }
        }

        return undefined;
    }
}
