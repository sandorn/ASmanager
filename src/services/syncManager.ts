import * as path from 'node:path';
import * as vscode from 'vscode';
import { SkillInfo, SyncMode, SyncRecord, AgentInfo } from '../types/models';
import {
    copyDirectory,
    createDirectoryLink,
    ensureDirectory,
    removePath,
} from './fileSystem';

const syncRecordsKey = 'agentSkillsManager.syncRecords';

export class SyncManager {
    constructor(private readonly globalState: vscode.Memento) {}

    async copySkill(
        skill: SkillInfo,
        destinationRoot: string,
        mode: SyncMode = 'copy',
    ): Promise<string> {
        await ensureDirectory(destinationRoot);
        const destination = path.join(
            destinationRoot,
            path.basename(skill.path),
        );

        if (mode === 'copy') {
            await copyDirectory(skill.path, destination);
        } else {
            await createDirectoryLink(skill.path, destination, mode);
        }

        await this.addRecord({
            skillName: skill.name,
            sourcePath: skill.path,
            destinationPath: destination,
            mode,
            syncedAt: new Date().toISOString(),
        });

        return destination;
    }

    getRecords(): SyncRecord[] {
        return this.globalState.get<SyncRecord[]>(syncRecordsKey, []);
    }

    async clearRecords(): Promise<void> {
        await this.globalState.update(syncRecordsKey, []);
    }

    async rollbackRecord(index: number): Promise<SyncRecord | undefined> {
        const records = this.getRecords();
        const record = records[index];
        if (!record) {
            return undefined;
        }

        await removePath(record.destinationPath);
        records.splice(index, 1);
        await this.globalState.update(syncRecordsKey, records);
        return record;
    }

    /**
     * 清理遗留同步：旧版本将技能直接同步到智能体配置根目录（如 ~/.claude/）
     * 而非 skills 子目录（如 ~/.claude/skills/）。此方法扫描所有记录，
     * 删除错误位置的目标目录及对应记录。
     * @returns 清理的遗留记录数量
     */
    async cleanupLegacySyncs(agents: AgentInfo[]): Promise<number> {
        const records = this.getRecords();
        if (records.length === 0) {
            return 0;
        }

        // 收集所有可能存在遗留问题的智能体根路径
        // 仅 skillsSubPath 非空的智能体才需要检查（空串意味着技能本就放在根目录）
        const legacyRoots = new Set<string>();
        for (const agent of agents) {
            if (!agent.skillsSubPath) {
                continue;
            }
            for (const candidatePath of agent.candidatePaths) {
                // 统一路径分隔符以便跨平台比较
                legacyRoots.add(path.normalize(candidatePath));
            }
        }

        const remaining: SyncRecord[] = [];
        let cleanedCount = 0;

        for (const record of records) {
            const destParent = path.normalize(
                path.dirname(record.destinationPath),
            );

            if (legacyRoots.has(destParent)) {
                // 该记录的目标目录直接位于智能体根路径下，属于遗留同步
                try {
                    await removePath(record.destinationPath);
                    cleanedCount += 1;
                } catch {
                    // 目录可能已被手动删除，仍然移除记录
                    cleanedCount += 1;
                }
            } else {
                remaining.push(record);
            }
        }

        await this.globalState.update(syncRecordsKey, remaining);
        return cleanedCount;
    }

    private async addRecord(record: SyncRecord): Promise<void> {
        const records = this.getRecords();
        records.unshift(record);
        await this.globalState.update(syncRecordsKey, records.slice(0, 200));
    }
}
