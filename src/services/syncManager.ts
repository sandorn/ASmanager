import * as path from 'node:path';
import * as vscode from 'vscode';
import { SkillInfo, SyncMode, SyncRecord } from '../types/models';
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

    private async addRecord(record: SyncRecord): Promise<void> {
        const records = this.getRecords();
        records.unshift(record);
        await this.globalState.update(syncRecordsKey, records.slice(0, 200));
    }
}
