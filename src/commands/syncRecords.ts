import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerShowSyncRecords(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.showSyncRecords',
        async () => {
            const records = ctx.syncManager.getRecords();
            const content = [
                localize(
                    '# Agent Skills Sync Records',
                    '# 智能体技能同步记录',
                ),
                '',
                records.length === 0
                    ? localize('No sync records yet.', '暂无同步记录。')
                    : records
                          .map(
                              (record) =>
                                  `- **${record.skillName}** ${record.mode} ${record.sourcePath} -> ${record.destinationPath} (${record.syncedAt})`,
                          )
                          .join('\n'),
            ].join('\n');

            const document = await vscode.workspace.openTextDocument({
                language: 'markdown',
                content,
            });
            await vscode.window.showTextDocument(document);
        },
    );
}

export function registerClearSyncRecords(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.clearSyncRecords',
        async () => {
            const choice = await vscode.window.showWarningMessage(
                localize(
                    'Clear all Agent Skills sync records?',
                    '清除全部智能体技能同步记录？',
                ),
                { modal: true },
                localize('Clear', '清除'),
            );

            if (choice !== localize('Clear', '清除')) {
                return;
            }

            await ctx.syncManager.clearRecords();
            vscode.window.showInformationMessage(
                localize('Sync records cleared.', '同步记录已清除。'),
            );
        },
    );
}
