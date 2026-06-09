import * as path from 'node:path';
import * as vscode from 'vscode';
import { SkillInfo, SyncMode } from '../types/models';
import { localize } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerSyncSkill(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.syncSkill',
        async (node?: SimpleTreeNode) => {
            let skill = node?.payload as SkillInfo | undefined;

            if (!skill) {
                let skills = ctx.getCachedSkills();
                if (skills.length === 0) {
                    await ctx.refreshAll();
                    skills = ctx.getCachedSkills();
                }

                const selected = await vscode.window.showQuickPick(
                    skills.map((item) => ({
                        label: item.name,
                        description: item.description,
                        skill: item,
                    })),
                    {
                        title: localize(
                            'Select a skill to sync',
                            '选择要同步的技能',
                        ),
                    },
                );
                skill = selected?.skill;
            }

            if (!skill) {
                return;
            }

            const target = await vscode.window.showOpenDialog({
                title: localize(
                    `Select destination folder for ${skill.name}`,
                    `选择 ${skill.name} 的目标文件夹`,
                ),
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: localize('Sync Here', '同步到这里'),
            });

            const destinationRoot = target?.[0]?.fsPath;
            if (!destinationRoot) {
                return;
            }

            const modePick = await vscode.window.showQuickPick(
                [
                    {
                        label: localize('Copy', '复制'),
                        description: localize(
                            'Most compatible mode',
                            '兼容性最好的模式',
                        ),
                        mode: 'copy' as SyncMode,
                    },
                    {
                        label: localize('Symlink', '符号链接'),
                        description: localize(
                            'Directory symbolic link',
                            '目录符号链接',
                        ),
                        mode: 'symlink' as SyncMode,
                    },
                    {
                        label: localize('Junction', '目录联接'),
                        description: localize(
                            'Windows directory junction',
                            'Windows 目录联接',
                        ),
                        mode: 'junction' as SyncMode,
                    },
                ],
                { title: localize('Select sync mode', '选择同步模式') },
            );

            if (!modePick) {
                return;
            }

            const destination = await ctx.syncManager.copySkill(
                skill,
                destinationRoot,
                modePick.mode,
            );
            vscode.window.showInformationMessage(
                localize(
                    `Synced ${skill.name} to ${path.normalize(destination)} using ${modePick.mode}.`,
                    `已使用 ${modePick.mode} 将 ${skill.name} 同步到 ${path.normalize(destination)}。`,
                ),
            );
        },
    );
}
