import * as vscode from 'vscode';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerRollbackSync(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.rollbackSync',
        async () => {
            const records = ctx.syncManager.getRecords();
            if (records.length === 0) {
                vscode.window.showInformationMessage(
                    localize(
                        'No sync records to rollback.',
                        '没有可回滚的同步记录。',
                    ),
                );
                return;
            }

            const pick = await vscode.window.showQuickPick(
                records.map((r, i) => ({
                    label: `${r.skillName} (${r.mode})`,
                    description: r.destinationPath,
                    detail: r.syncedAt,
                    index: i,
                })),
                {
                    title: localize(
                        'Select sync record to rollback',
                        '选择要回滚的同步记录',
                    ),
                },
            );

            if (pick === undefined) {
                return;
            }

            const choice = await vscode.window.showWarningMessage(
                localize(
                    `Rollback sync of "${records[pick.index].skillName}"? This will remove ${records[pick.index].destinationPath}.`,
                    `回滚"${records[pick.index].skillName}"的同步？这将移除 ${records[pick.index].destinationPath}。`,
                ),
                { modal: true },
                localize('Rollback', '回滚'),
            );

            if (choice !== localize('Rollback', '回滚')) {
                return;
            }

            const rolled = await ctx.syncManager.rollbackRecord(pick.index);
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Rolled back ${rolled?.skillName ?? ''}.`,
                    `已回滚 ${rolled?.skillName ?? ''}。`,
                ),
            );
        },
    );
}
