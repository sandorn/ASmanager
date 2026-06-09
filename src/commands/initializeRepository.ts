import * as vscode from 'vscode';
import { SkillRepository } from '../services/skillRepository';
import { getCentralRepository } from '../services/config';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerInitializeRepository(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.initializeRepository',
        async () => {
            const repository = new SkillRepository(getCentralRepository());
            await repository.initialize();
            await ctx.refreshAll();
            vscode.window.showInformationMessage(
                localize(
                    `Agent skills repository is ready: ${repository.path}`,
                    `智能体技能仓库已就绪：${repository.path}`,
                ),
            );
        },
    );
}
