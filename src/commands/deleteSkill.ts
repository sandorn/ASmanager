import * as vscode from 'vscode';
import { SkillInfo } from '../types/models';
import { SkillRepository } from '../services/skillRepository';
import { getCentralRepository } from '../services/config';
import { localize, t } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerDeleteSkill(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.deleteSkill',
        async (node?: SimpleTreeNode) => {
            const skill = node?.payload as SkillInfo | undefined;
            if (!skill) {
                vscode.window.showWarningMessage(
                    localize(
                        'Select a skill from the Skills tree to delete.',
                        '请从技能树中选择要删除的技能。',
                    ),
                );
                return;
            }

            const choice = await vscode.window.showWarningMessage(
                localize(
                    `Delete skill "${skill.name}"? This will remove ${skill.path}.`,
                    `删除技能"${skill.name}"？这将移除 ${skill.path}。`,
                ),
                { modal: true },
                t('delete'),
            );

            if (choice !== t('delete')) {
                return;
            }

            const repository = new SkillRepository(getCentralRepository());
            await repository.deleteSkill(skill.path);
            await ctx.refreshAll();
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Deleted skill "${skill.name}".`,
                    `已删除技能"${skill.name}"。`,
                ),
            );
        },
    );
}
