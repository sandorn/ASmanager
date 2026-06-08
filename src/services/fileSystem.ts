import * as fs from 'node:fs/promises';
import * as path from 'node:path';

async function pathExists(targetPath: string): Promise<boolean> {
    try {
        await fs.access(targetPath);
        return true;
    } catch {
        return false;
    }
}

export async function ensureDirectory(targetPath: string): Promise<void> {
    await fs.mkdir(targetPath, { recursive: true });
}

export async function listDirectories(targetPath: string): Promise<string[]> {
    if (!(await pathExists(targetPath))) {
        return [];
    }

    const entries = await fs.readdir(targetPath, { withFileTypes: true });
    return entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => path.join(targetPath, entry.name));
}

export async function fileExists(targetPath: string): Promise<boolean> {
    return pathExists(targetPath);
}

export async function copyDirectory(
    source: string,
    destination: string,
): Promise<void> {
    await fs.rm(destination, { recursive: true, force: true });
    await fs.cp(source, destination, { recursive: true, force: true });
}

export async function removePath(targetPath: string): Promise<void> {
    await fs.rm(targetPath, { recursive: true, force: true });
}

export async function createDirectoryLink(
    source: string,
    destination: string,
    mode: 'symlink' | 'junction',
): Promise<void> {
    await removePath(destination);
    await fs.symlink(
        source,
        destination,
        mode === 'junction' ? 'junction' : 'dir',
    );
}

export async function readJsonFile<T>(
    targetPath: string,
    fallback: T,
): Promise<T> {
    if (!(await pathExists(targetPath))) {
        return fallback;
    }

    const content = await fs.readFile(targetPath, 'utf8');
    return JSON.parse(content) as T;
}

export async function writeJsonFile(
    targetPath: string,
    value: unknown,
): Promise<void> {
    await ensureDirectory(path.dirname(targetPath));
    await fs.writeFile(
        targetPath,
        `${JSON.stringify(value, null, 2)}\n`,
        'utf8',
    );
}

export async function findFilesByName(
    targetPath: string,
    fileName: string,
): Promise<string[]> {
    if (!(await pathExists(targetPath))) {
        return [];
    }

    const matches: string[] = [];

    async function walk(currentPath: string): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            if (entry.name === '.git' || entry.name === 'node_modules') {
                continue;
            }

            const entryPath = path.join(currentPath, entry.name);
            if (entry.isDirectory()) {
                await walk(entryPath);
            } else if (entry.name.toLowerCase() === fileName.toLowerCase()) {
                matches.push(entryPath);
            }
        }
    }

    await walk(targetPath);
    return matches;
}

export async function getDirectoryStats(
    targetPath: string,
): Promise<{ fileCount: number; sizeBytes: number; updatedAt: Date }> {
    let fileCount = 0;
    let sizeBytes = 0;
    let updatedAt = new Date(0);

    async function walk(currentPath: string): Promise<void> {
        const entries = await fs.readdir(currentPath, { withFileTypes: true });

        for (const entry of entries) {
            const entryPath = path.join(currentPath, entry.name);
            const stats = await fs.stat(entryPath);
            if (stats.mtime > updatedAt) {
                updatedAt = stats.mtime;
            }

            if (entry.isDirectory()) {
                await walk(entryPath);
            } else {
                fileCount += 1;
                sizeBytes += stats.size;
            }
        }
    }

    await walk(targetPath);
    return { fileCount, sizeBytes, updatedAt };
}
