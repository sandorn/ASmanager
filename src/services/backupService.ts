import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { copyDirectory, ensureDirectory } from './fileSystem';

export class BackupService {
    constructor(private readonly repositoryPath: string) {}

    async backup(destinationRoot: string): Promise<string> {
        const stamp = new Date()
            .toISOString()
            .replace(/[:.]+/g, '-')
            .slice(0, 19);
        const backupPath = path.join(
            destinationRoot,
            `asmanager-backup-${stamp}`,
        );
        await ensureDirectory(backupPath);
        await copyDirectory(this.repositoryPath, backupPath);
        return backupPath;
    }

    async restore(sourcePath: string): Promise<string[]> {
        const entries = await fs.readdir(sourcePath, { withFileTypes: true });
        const restored: string[] = [];

        for (const entry of entries) {
            if (entry.name === '.sources') {
                continue; // skip source caches during restore
            }

            const source = path.join(sourcePath, entry.name);
            const dest = path.join(this.repositoryPath, entry.name);

            if (entry.isDirectory()) {
                try {
                    await copyDirectory(source, dest);
                    restored.push(entry.name);
                } catch {
                    // skip on conflict
                }
            } else {
                try {
                    await fs.copyFile(source, dest);
                    restored.push(entry.name);
                } catch {
                    // skip on conflict
                }
            }
        }

        return restored;
    }
}
