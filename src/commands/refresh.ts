import * as vscode from 'vscode';
import { CommandContext } from './commandContext';

export function registerRefresh(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.refresh',
        async () => {
            await ctx.refreshAll();
        },
    );
}
