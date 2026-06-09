import * as vscode from 'vscode';
import { getConfiguredSources } from '../services/config';
import { localize, t } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerCheckSourceUpdates(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.checkSourceUpdates',
        async () => {
            const sources = getConfiguredSources();
            if (sources.length === 0) {
                vscode.window.showInformationMessage(
                    t('noSourcesConfiguredTable'),
                );
                return;
            }

            const manager = ctx.getSourceManager();
            const lines: string[] = [
                localize('# Source Update Status', '# 来源更新状态'),
                '',
            ];

            for (const url of sources) {
                const status = await manager.checkForUpdates(url);
                lines.push(
                    `- **${url.replace(/^https?:\/\//, '')}**: ${status.detail}`,
                );
            }

            const doc = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content: lines.join('\n'),
            });
            await vscode.window.showTextDocument(doc);
        },
    );
}
