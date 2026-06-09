import { execFile } from 'node:child_process';
import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { promisify } from 'node:util';
import { SourceInfo, SourceSkillInfo } from '../types/models';
import {
    copyDirectory,
    ensureDirectory,
    fileExists,
    findFilesByName,
    removePath,
} from './fileSystem';
import { localize } from './localization';

const execFileAsync = promisify(execFile);
const gitTimeoutMs = 5 * 60 * 1000;

function sourceFolderName(url: string): string {
    const readable = url
        .replace(/^https?:\/\//, '')
        .replace(/\.git$/, '')
        .replace(/[^a-zA-Z0-9_.-]+/g, '-');
    const hash = crypto
        .createHash('sha1')
        .update(url)
        .digest('hex')
        .slice(0, 8);
    return `${readable}-${hash}`;
}

function parseDescription(markdown: string): string {
    const descriptionMatch = markdown.match(
        /^description:\s*["']?(.+?)["']?\s*$/im,
    );
    if (descriptionMatch?.[1]) {
        return descriptionMatch[1].trim();
    }

    const paragraph = markdown
        .split(/\r?\n/)
        .map((line) => line.trim())
        .find((line) => line && !line.startsWith('#') && !line.includes(':'));

    return paragraph || localize('No description found.', '未找到描述。');
}

export class SourceManager {
    private readonly sourcesRoot: string;

    constructor(private readonly repositoryPath: string) {
        this.sourcesRoot = path.join(repositoryPath, '.sources');
    }

    async list(urls: string[]): Promise<SourceInfo[]> {
        await ensureDirectory(this.sourcesRoot);
        const sources: SourceInfo[] = [];

        for (const url of urls) {
            const localPath = this.getLocalPath(url);
            const installed = await fileExists(localPath);
            sources.push({
                url,
                configured: true,
                localPath,
                installed,
                detail: installed
                    ? localize(
                          `Cached at ${localPath}`,
                          `已缓存于 ${localPath}`,
                      )
                    : localize('Not fetched yet', '尚未拉取'),
            });
        }

        return sources;
    }

    async update(url: string): Promise<string> {
        await ensureDirectory(this.sourcesRoot);
        const localPath = this.getLocalPath(url);

        if (await fileExists(path.join(localPath, '.git'))) {
            await execFileAsync('git', ['-C', localPath, 'pull', '--ff-only'], {
                timeout: gitTimeoutMs,
            });
            return localPath;
        }

        await execFileAsync('git', ['clone', '--depth', '1', url, localPath], {
            timeout: gitTimeoutMs,
        });
        return localPath;
    }

    async checkForUpdates(url: string): Promise<{
        behind: boolean;
        detail: string;
    }> {
        const localPath = this.getLocalPath(url);
        if (!(await fileExists(path.join(localPath, '.git')))) {
            return {
                behind: false,
                detail: localize('Not cloned yet', '尚未克隆'),
            };
        }

        try {
            await execFileAsync('git', [
                '-C',
                localPath,
                'fetch',
                '--depth',
                '1',
                'origin',
            ]);
            const { stdout } = await execFileAsync('git', [
                '-C',
                localPath,
                'rev-list',
                '--count',
                'HEAD..origin/HEAD',
            ]);
            const behind = parseInt(stdout.trim(), 10) || 0;
            return {
                behind: behind > 0,
                detail:
                    behind > 0
                        ? localize(
                              `${behind} commit(s) behind`,
                              `落后 ${behind} 个提交`,
                          )
                        : localize('Up to date', '已是最新'),
            };
        } catch {
            return {
                behind: false,
                detail: localize('Could not check', '无法检查'),
            };
        }
    }

    async updateAll(
        urls: string[],
        onProgress?: (url: string, index: number, total: number) => void,
    ): Promise<string[]> {
        const updated: string[] = [];
        const errors: Array<{ url: string; message: string }> = [];
        for (let index = 0; index < urls.length; index += 1) {
            const url = urls[index];
            onProgress?.(url, index + 1, urls.length);
            try {
                updated.push(await this.update(url));
            } catch (error) {
                errors.push({ url, message: String(error) });
            }
        }
        if (errors.length > 0) {
            const details = errors
                .map((e) => `- ${e.url}: ${e.message}`)
                .join('\n');
            throw new Error(
                localize(
                    `Failed to update ${errors.length} source(s):\n${details}`,
                    `更新 ${errors.length} 个来源失败：\n${details}`,
                ),
            );
        }
        return updated;
    }

    async discoverSkills(urls: string[]): Promise<SourceSkillInfo[]> {
        const skills: SourceSkillInfo[] = [];
        for (const url of urls) {
            const localPath = this.getLocalPath(url);
            const skillFiles = await findFilesByName(localPath, 'SKILL.md');

            for (const skillFile of skillFiles) {
                const skillPath = path.dirname(skillFile);
                const markdown = await fs.readFile(skillFile, 'utf8');
                const heading = markdown.match(/^#\s+(.+)$/m)?.[1]?.trim();
                skills.push({
                    name: heading || path.basename(skillPath),
                    description: parseDescription(markdown),
                    path: skillPath,
                    sourceUrl: url,
                });
            }
        }

        return skills.sort((left, right) =>
            left.name.localeCompare(right.name),
        );
    }

    async installAllFromSource(url: string): Promise<string[]> {
        const skills = await this.discoverSkills([url]);
        const installed: string[] = [];
        for (const skill of skills) {
            const dest = await this.installSkill(skill);
            installed.push(dest);
        }
        return installed;
    }

    async installSkill(skill: SourceSkillInfo): Promise<string> {
        await ensureDirectory(this.repositoryPath);
        const destination = path.join(
            this.repositoryPath,
            path.basename(skill.path),
        );
        await copyDirectory(skill.path, destination);
        return destination;
    }

    async removeSourceCache(url: string): Promise<void> {
        const localPath = this.getLocalPath(url);
        await removePath(localPath);
    }

    private getLocalPath(url: string): string {
        return path.join(this.sourcesRoot, sourceFolderName(url));
    }
}
