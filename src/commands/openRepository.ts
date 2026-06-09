import * as vscode from 'vscode';
import { getCentralRepository } from '../services/config';
import { CommandContext } from './commandContext';

export function registerOpenRepository(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.openRepository',
        async () => {
            const repositoryPath = getCentralRepository();
            await vscode.commands.executeCommand(
                'vscode.openFolder',
                vscode.Uri.file(repositoryPath),
                { forceNewWindow: false },
            );
        },
    );
}
