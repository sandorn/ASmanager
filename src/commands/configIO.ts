import * as fs from 'node:fs/promises';
import * as vscode from 'vscode';
import { getConfiguredSources } from '../services/config';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerExportConfig(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.exportConfig',
        async () => {
            const target = await vscode.window.showSaveDialog({
                title: localize(
                    'Export ASmanager Config',
                    '导出 ASmanager 配置',
                ),
                filters: {
                    [localize('JSON Files', 'JSON 文件')]: ['json'],
                },
                defaultUri: vscode.Uri.file('asmanager-config.json'),
            });

            if (!target) {
                return;
            }

            const config =
                vscode.workspace.getConfiguration('agentSkillsManager');
            const data: Record<string, unknown> = {};
            const keys = ['centralRepository', 'sources'];
            for (const key of keys) {
                const inspected = config.inspect(key);
                data[key] =
                    inspected?.globalValue ??
                    inspected?.workspaceValue ??
                    inspected?.defaultValue;
            }

            const content = JSON.stringify(data, null, 2);
            await fs.writeFile(target.fsPath, content, 'utf8');
            vscode.window.showInformationMessage(
                localize(
                    'Config exported successfully.',
                    '配置已成功导出。',
                ),
            );
        },
    );
}

export function registerImportConfig(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.importConfig',
        async () => {
            const source = await vscode.window.showOpenDialog({
                title: localize(
                    'Import ASmanager Config',
                    '导入 ASmanager 配置',
                ),
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    [localize('JSON Files', 'JSON 文件')]: ['json'],
                },
            });

            if (!source?.[0]) {
                return;
            }

            const content = await fs.readFile(source[0].fsPath, 'utf8');
            const data = JSON.parse(content) as Record<string, unknown>;

            const configuration =
                vscode.workspace.getConfiguration('agentSkillsManager');

            if (typeof data.centralRepository === 'string') {
                await configuration.update(
                    'centralRepository',
                    data.centralRepository,
                    vscode.ConfigurationTarget.Global,
                );
            }

            if (Array.isArray(data.sources)) {
                await configuration.update(
                    'sources',
                    data.sources,
                    vscode.ConfigurationTarget.Global,
                );
            }

            await ctx.refreshAll();
            vscode.window.showInformationMessage(
                localize(
                    'Config imported and applied.',
                    '配置已导入并应用。',
                ),
            );
        },
    );
}
