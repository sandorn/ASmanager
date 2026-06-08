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
            },
            {
                id: 'codex',
                name: 'Codex',
                candidatePaths: [path.join(home, '.codex')],
            },
            {
                id: 'opencode',
                name: 'OpenCode',
                candidatePaths: [
                    path.join(home, '.opencode'),
                    path.join(appData, 'opencode'),
                ],
            },
            {
                id: 'cursor',
                name: 'Cursor',
                candidatePaths: [
                    path.join(appData, 'Cursor'),
                    path.join(userProfile, '.cursor'),
                ],
            },
            {
                id: 'gemini-cli',
                name: 'Gemini CLI',
                candidatePaths: [path.join(home, '.gemini')],
            },
            {
                id: 'copilot',
                name: 'Copilot',
                candidatePaths: [
                    path.join(appData, 'Code', 'User', 'prompts'),
                    path.join(appData, 'Code', 'User'),
                ],
            },
            {
                id: 'cline',
                name: 'Cline',
                candidatePaths: [
                    path.join(
                        appData,
                        'Code',
                        'User',
                        'globalStorage',
                        'saoudrizwan.claude-dev',
                    ),
                ],
            },
            {
                id: 'roo-code',
                name: 'Roo Code',
                candidatePaths: [
                    path.join(
                        appData,
                        'Code',
                        'User',
                        'globalStorage',
                        'rooveterinaryinc.roo-cline',
                    ),
                ],
            },
            {
                id: 'kimi',
                name: 'Kimi',
                candidatePaths: [path.join(home, '.kimi')],
            },
            {
                id: 'qwen',
                name: 'Qwen',
                candidatePaths: [path.join(home, '.qwen')],
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
