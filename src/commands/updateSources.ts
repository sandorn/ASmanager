import * as vscode from 'vscode';
import { getConfiguredSources } from '../services/config';
import { localize } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerUpdateSources(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.updateSources',
        async () => {
            const sources = getConfiguredSources();
            if (sources.length === 0) {
                vscode.window.showInformationMessage(
                    localize(
                        'No skill sources configured.',
                        '未配置技能来源。',
                    ),
                );
                return;
            }

            await vscode.window.withProgress(
                {
                    location: vscode.ProgressLocation.Notification,
                    title: localize(
                        'Updating skill sources',
                        '正在更新技能来源',
                    ),
                    cancellable: false,
                },
                async (progress) => {
                    await ctx.getSourceManager().updateAll(
                        sources,
                        (url, index, total) => {
                            progress.report({
                                message: localize(
                                    `${index}/${total}: ${url}`,
                                    `${index}/${total}：${url}`,
                                ),
                            });
                        },
                    );
                },
            );

            await ctx.refreshAll();
            vscode.window.showInformationMessage(
                localize(
                    `Updated ${sources.length} skill source(s).`,
                    `已更新 ${sources.length} 个技能来源。`,
                ),
            );
        },
    );
}
