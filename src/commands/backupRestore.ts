import * as vscode from 'vscode';
import { BackupService } from '../services/backupService';
import { getCentralRepository } from '../services/config';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerBackupRepository(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.backupRepository',
        async () => {
            const target = await vscode.window.showOpenDialog({
                title: localize(
                    'Select backup destination folder',
                    '选择备份目标文件夹',
                ),
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: localize('Backup Here', '备份到这里'),
            });

            if (!target?.[0]) {
                return;
            }

            const backup = new BackupService(getCentralRepository());
            const dest = await backup.backup(target[0].fsPath);
            vscode.window.showInformationMessage(
                localize(
                    `Repository backed up to ${dest}.`,
                    `仓库已备份到 ${dest}。`,
                ),
            );
        },
    );
}

export function registerRestoreRepository(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.restoreRepository',
        async () => {
            const source = await vscode.window.showOpenDialog({
                title: localize(
                    'Select backup folder to restore from',
                    '选择要恢复的备份文件夹',
                ),
                canSelectFiles: false,
                canSelectFolders: true,
                canSelectMany: false,
                openLabel: localize('Restore From', '从这里恢复'),
            });

            if (!source?.[0]) {
                return;
            }

            const backup = new BackupService(getCentralRepository());
            const restored = await backup.restore(source[0].fsPath);
            await ctx.refreshAll();
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Restored ${restored.length} item(s): ${restored.join(', ') || '(none)'}.`,
                    `已恢复 ${restored.length} 项：${restored.join(', ') || '（无）'}。`,
                ),
            );
        },
    );
}
