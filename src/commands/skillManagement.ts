import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { SkillInfo, SourceSkillInfo, SourceInfo } from '../types/models';
import { getConfiguredSources } from '../services/config';
import { localize, t } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerRenameSkill(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.renameSkill',
        async (node?: SimpleTreeNode) => {
            const skill = node?.payload as SkillInfo | undefined;
            if (!skill) {
                vscode.window.showWarningMessage(
                    localize(
                        'Select a skill from the Skills tree to rename.',
                        '请从技能树中选择要重命名的技能。',
                    ),
                );
                return;
            }

            const marker =
                skill.skillFile &&
                (await fs
                    .access(skill.skillFile)
                    .then(() => true)
                    .catch(() => false))
                    ? await fs.readFile(skill.skillFile, 'utf8')
                    : '';

            const headingMatch = marker.match(/^#\s+(.+)$/m);
            const currentName = headingMatch?.[1]?.trim() || skill.name;

            const newName = await vscode.window.showInputBox({
                title: localize(
                    `Rename skill "${currentName}"`,
                    `重命名技能"${currentName}"`,
                ),
                prompt: localize(
                    'Enter a new name for this skill.',
                    '请输入这个技能的新名称。',
                ),
                value: currentName,
                validateInput: (input) =>
                    input.trim().length === 0
                        ? localize('Name is required.', '名称不能为空。')
                        : undefined,
            });

            if (!newName || newName === currentName) {
                return;
            }

            if (headingMatch) {
                const updated = marker.replace(/^#\s+.+$/m, `# ${newName}`);
                await fs.writeFile(skill.skillFile, updated, 'utf8');
            }

            await ctx.refreshAll();
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Renamed skill to "${newName}".`,
                    `已将技能重命名为"${newName}"。`,
                ),
            );
        },
    );
}

export function registerEditSkillMarkdown(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.editSkillMarkdown',
        async (node?: SimpleTreeNode) => {
            const skill = node?.payload as SkillInfo | undefined;
            if (!skill) {
                vscode.window.showWarningMessage(
                    localize(
                        'Select a skill to edit its SKILL.md.',
                        '请选择要编辑 SKILL.md 的技能。',
                    ),
                );
                return;
            }
            const doc = await vscode.workspace.openTextDocument(
                vscode.Uri.file(skill.skillFile),
            );
            await vscode.window.showTextDocument(doc);
        },
    );
}

export function registerShowSourceSkills(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.showSourceSkills',
        async (node?: SimpleTreeNode) => {
            const source = node?.payload as SourceInfo | undefined;
            const urls = source?.url
                ? [source.url]
                : getConfiguredSources();
            if (urls.length === 0) {
                vscode.window.showInformationMessage(
                    t('noSourcesConfiguredTable'),
                );
                return;
            }

            const manager = ctx.getSourceManager();
            const skills = await manager.discoverSkills(urls);
            if (skills.length === 0) {
                vscode.window.showInformationMessage(
                    localize(
                        'No SKILL.md files found. Update the source first.',
                        '未找到 SKILL.md 文件。请先更新来源。',
                    ),
                );
                return;
            }

            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: [
                    localize(
                        `# Source Skills (${urls.join(', ')})`,
                        `# 来源技能（${urls.join(', ')}）`,
                    ),
                    '',
                    ...skills.map(
                        (s) =>
                            `- **${s.name}** — ${s.description} (${s.path})`,
                    ),
                ].join('\n'),
            });
            await vscode.window.showTextDocument(doc);
        },
    );
}

export function registerInstallAllFromSource(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.installAllFromSource',
        async (node?: SimpleTreeNode) => {
            const source = node?.payload as SourceInfo | undefined;
            const urls = source?.url
                ? [source.url]
                : getConfiguredSources();
            if (urls.length === 0) {
                vscode.window.showInformationMessage(
                    t('noSourcesConfiguredTable'),
                );
                return;
            }

            const choice = await vscode.window.showWarningMessage(
                localize(
                    'Install ALL skills from source(s)? This may overwrite existing skills.',
                    '安装来源中的全部技能？这可能会覆盖现有技能。',
                ),
                { modal: true },
                localize('Install All', '全部安装'),
            );
            if (choice !== localize('Install All', '全部安装')) {
                return;
            }

            const manager = ctx.getSourceManager();
            let total = 0;
            for (const url of urls) {
                const installed = await manager.installAllFromSource(url);
                total += installed.length;
            }

            await ctx.refreshAll();
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Installed ${total} skill(s) from source(s).`,
                    `已从来源安装 ${total} 个技能。`,
                ),
            );
        },
    );
}

export function registerInstallSkillFromSource(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.installSkillFromSource',
        async (node?: SimpleTreeNode) => {
            const source = node?.payload as SourceInfo | undefined;
            const sourceUrls = source?.url
                ? [source.url]
                : getConfiguredSources();
            const manager = ctx.getSourceManager();

            if (sourceUrls.length === 0) {
                vscode.window.showInformationMessage(
                    localize(
                        'No skill sources configured.',
                        '未配置技能来源。',
                    ),
                );
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: localize(
                        'Updating skill sources',
                        '正在更新技能来源',
                    ),
                    cancellable: false,
                },
                async (progress) => {
                    await manager.updateAll(
                        sourceUrls,
                        (url, index, total) => {
                            progress.report({
                                message: localize(
                                    `${index}/${total}: ${url}`,
                                    `${index}/${total}：${url}`,
                                ),
                            });
                        },
                    );
                },
            );

            const sourceSkills = await manager.discoverSkills(sourceUrls);
            if (sourceSkills.length === 0) {
                vscode.window.showWarningMessage(
                    localize(
                        'No SKILL.md files found in selected source(s).',
                        '所选来源中未找到 SKILL.md 文件。',
                    ),
                );
                return;
            }

            const selected = await vscode.window.showQuickPick(
                sourceSkills.map((skill: SourceSkillInfo) => ({
                    label: skill.name,
                    description: skill.description,
                    detail: skill.sourceUrl,
                    skill,
                })),
                {
                    title: localize(
                        'Install Skill From Source',
                        '从来源安装技能',
                    ),
                },
            );

            if (!selected) {
                return;
            }

            const destination = await manager.installSkill(selected.skill);
            await ctx.refreshAll();
            vscode.window.showInformationMessage(
                localize(
                    `Installed ${selected.skill.name} to ${destination}.`,
                    `已将 ${selected.skill.name} 安装到 ${destination}。`,
                ),
            );
        },
    );
}
