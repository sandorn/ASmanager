import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { SkillInfo } from '../types/models';
import {
    ensureDirectory,
    fileExists,
    getDirectoryStats,
    listDirectories,
    removePath,
} from './fileSystem';

function parseSkillMarkdown(
    markdown: string,
    fallbackName: string,
): {
    name: string;
    description: string;
    issues: string[];
    tags: string[];
    category: string;
} {
    const issues: string[] = [];
    const tags: string[] = [];
    let category = '';

    const nameMatch =
        markdown.match(/^#\s+(.+)$/m) ?? markdown.match(/^name:\s*(.+)$/im);

    const tagsMatch = markdown.match(/^tags:\s*\[(.+)\]$/im);
    if (tagsMatch?.[1]) {
        tags.push(
            ...tagsMatch[1]
                .split(',')
                .map((t) => t.trim().replace(/['"]/g, ''))
                .filter(Boolean),
        );
    }

    const catMatch = markdown.match(/^category:\s*(.+)$/im);
    if (catMatch?.[1]) {
        category = catMatch[1].trim();
    }

    const descriptionMatch = markdown.match(
        /^description:\s*["']?(.+?)["']?\s*$/im,
    );

    const name = nameMatch?.[1]?.trim() || fallbackName;
    let description = descriptionMatch?.[1]?.trim() || '';

    if (!description) {
        const paragraph = markdown
            .split(/\r?\n/)
            .map((line) => line.trim())
            .find(
                (line) => line && !line.startsWith('#') && !line.includes(':'),
            );
        description = paragraph || 'No description found.';
    }

    if (!nameMatch) {
        issues.push('Missing explicit skill name.');
    }

    if (description === 'No description found.') {
        issues.push('Missing description.');
    }

    return { name, description, issues, tags, category };
}

export class SkillRepository {
    constructor(private readonly repositoryPath: string) {}

    get path(): string {
        return this.repositoryPath;
    }

    async initialize(): Promise<void> {
        await ensureDirectory(this.repositoryPath);
    }

    async scan(): Promise<SkillInfo[]> {
        await this.initialize();
        const directories = await listDirectories(this.repositoryPath);
        const skills: SkillInfo[] = [];

        for (const directory of directories) {
            const dirName = path.basename(directory);
            if (dirName.startsWith('.') || dirName === 'node_modules') {
                continue;
            }

            const skillFile = path.join(directory, 'SKILL.md');
            const issues: string[] = [];

            if (!(await fileExists(skillFile))) {
                skills.push({
                    name: path.basename(directory),
                    description: 'SKILL.md not found.',
                    path: directory,
                    skillFile,
                    fileCount: 0,
                    sizeBytes: 0,
                    updatedAt: new Date(0),
                    status: 'error',
                    issues: ['Missing SKILL.md.'],
                    tags: [],
                    category: '',
                    score: 0,
                });
                continue;
            }

            const markdown = await fs.readFile(skillFile, 'utf8');
            const parsed = parseSkillMarkdown(
                markdown,
                path.basename(directory),
            );
            issues.push(...parsed.issues);

            const stats = await getDirectoryStats(directory);
            if (stats.fileCount === 0) {
                issues.push('Skill directory is empty.');
            }

            const status = issues.length > 0 ? 'warning' : 'ready';
            const hasName = !issues.includes('Missing explicit skill name.');
            const hasDesc = !issues.includes('Missing description.');
            const score =
                Math.round(
                    ((hasName ? 30 : 0) +
                        (hasDesc ? 20 : 0) +
                        (parsed.tags.length > 0 ? 15 : 0) +
                        (parsed.category ? 10 : 0) +
                        (stats.fileCount > 1 ? 10 : 0) +
                        (stats.fileCount >= 3 ? 10 : 0) +
                        (stats.sizeBytes < 10 * 1024 * 1024 ? 5 : 0)) *
                        10,
                ) / 10;

            skills.push({
                name: parsed.name,
                description: parsed.description,
                path: directory,
                skillFile,
                fileCount: stats.fileCount,
                sizeBytes: stats.sizeBytes,
                updatedAt: stats.updatedAt,
                status,
                issues,
                tags: parsed.tags,
                category: parsed.category,
                score,
            });
        }

        return skills.sort((left, right) =>
            left.name.localeCompare(right.name),
        );
    }

    async deleteSkill(skillPath: string): Promise<void> {
        await removePath(skillPath);
    }
}
