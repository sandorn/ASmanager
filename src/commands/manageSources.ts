import * as vscode from 'vscode';
import { CommandContext } from './commandContext';
import { getConfiguredSources } from '../services/config';
import { renderSourceManager } from '../views/sourceManagerWebview';
import { SKILL_SOURCE_CATALOG } from '../services/skillSourceCatalog';

export function registerManageSources(
    _context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.manageSources',
        async () => {
            const configuredUrls = getConfiguredSources();
            const sourceManager = ctx.getSourceManager();
            const sourceList = await sourceManager.list(configuredUrls);
            const installedSources = sourceList.map((s) => ({
                url: s.url,
                installed: s.installed ?? false,
            }));

            const panel = vscode.window.createWebviewPanel(
                'agentSkillsManager.sourceManager',
                'Skill Source Manager',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true,
                },
            );

            panel.webview.html = renderSourceManager(panel.webview, {
                configuredUrls,
                installedSources,
            });

            panel.webview.onDidReceiveMessage(
                async (message: {
                    command: string;
                    payload?: Record<string, unknown>;
                }) => {
                    switch (message.command) {
                        case 'applySources': {
                            const urls = (message.payload?.urls as string[]) ?? [];
                            await applySources(urls);
                            panel.dispose();
                            await ctx.refreshAll();
                            await ctx.updateManagerPanel();
                            break;
                        }
                        case 'cancel': {
                            panel.dispose();
                            break;
                        }
                        case 'addCustomSource': {
                            const url = String(message.payload?.url ?? '').trim();
                            if (!url) break;
                            const currentUrls = getConfiguredSources();
                            if (!currentUrls.includes(url)) {
                                const newUrls = [...currentUrls, url];
                                const configuration = vscode.workspace.getConfiguration('agentSkillsManager');
                                await configuration.update(
                                    'sources',
                                    newUrls,
                                    vscode.ConfigurationTarget.Global,
                                );
                                // Refresh the webview with updated data
                                const updatedList = await ctx
                                    .getSourceManager()
                                    .list(newUrls);
                                const updatedInstalled = updatedList.map((s) => ({
                                    url: s.url,
                                    installed: s.installed ?? false,
                                }));
                                panel.webview.html = renderSourceManager(
                                    panel.webview,
                                    { configuredUrls: newUrls, installedSources: updatedInstalled },
                                );
                            }
                            break;
                        }
                        case 'openUrl': {
                            const url = String(message.payload?.url ?? '');
                            if (url) {
                                await vscode.env.openExternal(vscode.Uri.parse(url));
                            }
                            break;
                        }
                    }
                },
            );
        },
    );
}

async function applySources(urls: string[]): Promise<void> {
    const configuration =
        vscode.workspace.getConfiguration('agentSkillsManager');
    // 过滤掉平台 URL（非 git 仓库）
    const platformUrls = new Set(
        SKILL_SOURCE_CATALOG.filter((e) => e.isPlatform).map((e) => e.url),
    );
    const gitUrls = urls.filter((u) => !platformUrls.has(u));

    await configuration.update(
        'sources',
        gitUrls,
        vscode.ConfigurationTarget.Global,
    );
}
