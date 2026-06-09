import * as vscode from 'vscode';
import { SourceInfo } from '../types/models';
import { getConfiguredSources } from '../services/config';
import { localize, t } from '../services/localization';
import { SimpleTreeNode } from '../views/treeNode';
import { CommandContext } from './commandContext';

export function registerRemoveSource(
    context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.removeSource',
        async (node?: SimpleTreeNode) => {
            const source = node?.payload as SourceInfo | undefined;
            if (!source?.url) {
                vscode.window.showWarningMessage(
                    localize(
                        'Select a source from the Sources tree to remove.',
                        '请从来源树中选择要移除的来源。',
                    ),
                );
                return;
            }

            const choice = await vscode.window.showWarningMessage(
                localize(
                    `Remove source "${source.url}"?`,
                    `移除来源"${source.url}"？`,
                ),
                { modal: true },
                t('remove'),
            );

            if (choice !== t('remove')) {
                return;
            }

            const configuration =
                vscode.workspace.getConfiguration('agentSkillsManager');
            const existing = [...getConfiguredSources()];
            const updated = existing.filter((url) => url !== source.url);
            await configuration.update(
                'sources',
                updated,
                vscode.ConfigurationTarget.Global,
            );

            await ctx.getSourceManager().removeSourceCache(source.url);
            await ctx.refreshAll();
            await ctx.updateManagerPanel();
            vscode.window.showInformationMessage(
                localize(
                    `Removed source "${source.url}".`,
                    `已移除来源"${source.url}"。`,
                ),
            );
        },
    );
}
