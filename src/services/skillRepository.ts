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
import { localize } from './localization';

function parseFrontMatter(
    markdown: string,
): {
    name: string;
    description: string;
    tags: string[];
    category: string;
} | null {
    const fmMatch = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---/);
    if (!fmMatch) {
        return null;
    }

    const lines = fmMatch[1].split(/\r?\n/);
    let name = '';
    let description = '';
    const tags: string[] = [];
    let category = '';

    for (let idx = 0; idx < lines.length; idx += 1) {
        const line = lines[idx];
        const kv = line.match(/^(\w[\w-]*):\s*(.*)$/);
        if (!kv) {
            continue;
        }

        const key = kv[1].trim();
        const rawValue = kv[2].trim();

        if (rawValue === '>') {
            // YAML folded block scalar — collect indented continuation lines
            const continuation: string[] = [];
            let nextIdx = idx + 1;
            while (
                nextIdx < lines.length &&
                (lines[nextIdx].startsWith('  ') ||
                    lines[nextIdx].startsWith('\t'))
            ) {
                continuation.push(lines[nextIdx].trimStart());
                nextIdx += 1;
            }
            idx = nextIdx - 1;
            const folded = continuation.join(' ').trim();
            if (key === 'description') {
                description = folded;
            }
            continue;
        }

        if (key === 'name' && !name) {
            name = rawValue.replace(/^['"]|['"]$/g, '');
        } else if (key === 'description' && !description) {
            description = rawValue.replace(/^['"]|['"]$/g, '');
        } else if (key === 'category' && !category) {
            category = rawValue.replace(/^['"]|['"]$/g, '');
        } else if (key === 'tags' && tags.length === 0) {
            const arr = rawValue.match(/^\[(.+)\]$/);
            if (arr?.[1]) {
                tags.push(
                    ...arr[1]
                        .split(',')
                        .map((t) => t.trim().replace(/['"]/g, ''))
                        .filter(Boolean),
                );
            }
        } else if (key === 'metadata') {
            // Inline metadata: tags: a, b, c
            const subTags = rawValue.match(/tags:\s*([^,]+(?:,\s*[^,]+)*)/);
            if (subTags?.[1] && tags.length === 0) {
                tags.push(
                    ...subTags[1]
                        .split(',')
                        .map((t) => t.trim().replace(/['"]/g, ''))
                        .filter(Boolean),
                );
            }
            // Try indented metadata on next lines
            if (!subTags) {
                let subIdx = idx + 1;
                while (
                    subIdx < lines.length &&
                    (lines[subIdx].startsWith('  ') ||
                        lines[subIdx].startsWith('\t'))
                ) {
                    const subKv = lines[subIdx]
                        .trim()
                        .match(/^([\w-]+):\s*(.*)$/);
                    if (subKv?.[1] === 'tags') {
                        const metaTags = subKv[2]
                            .split(',')
                            .map((t) => t.trim().replace(/['"]/g, ''))
                            .filter(Boolean);
                        tags.push(...metaTags);
                    }
                    subIdx += 1;
                }
            }
        }
    }

    if (name || description) {
        return { name, description, tags, category };
    }

    return null;
}

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

    // Try YAML front matter first
    const fm = parseFrontMatter(markdown);
    if (fm) {
        const name = fm.name || fallbackName;
        const description =
            fm.description || localize('No description found.', '未找到描述。');

        const hasName = Boolean(fm.name);
        const hasDesc = Boolean(fm.description);

        if (!hasName) {
            issues.push(
                localize(
                    'Missing explicit skill name.',
                    '缺少明确的技能名称。',
                ),
            );
        }

        if (!hasDesc) {
            issues.push(localize('Missing description.', '缺少描述。'));
        }

        return {
            name,
            description,
            issues,
            tags: fm.tags,
            category: fm.category,
        };
    }

    // Fallback: plain markdown regex parsing
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
        description =
            paragraph || localize('No description found.', '未找到描述。');
    }

    if (!nameMatch) {
        issues.push(
            localize('Missing explicit skill name.', '缺少明确的技能名称。'),
        );
    }

    if (description === localize('No description found.', '未找到描述。')) {
        issues.push(localize('Missing description.', '缺少描述。'));
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
                    description: localize(
                        'SKILL.md not found.',
                        '未找到 SKILL.md。',
                    ),
                    path: directory,
                    skillFile,
                    fileCount: 0,
                    sizeBytes: 0,
                    updatedAt: new Date(0),
                    status: 'error',
                    issues: [localize('Missing SKILL.md.', '缺少 SKILL.md。')],
                    tags: [],
                    category: '',
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
                issues.push(
                    localize('Skill directory is empty.', '技能目录为空。'),
                );
            }

            const status = issues.length > 0 ? 'warning' : 'ready';

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
