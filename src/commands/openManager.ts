import * as vscode from 'vscode';
import { SkillRepository } from '../services/skillRepository';
import { getCentralRepository, getConfiguredSources } from '../services/config';
import { localize, t } from '../services/localization';
import { CommandContext } from './commandContext';

export function registerOpenManager(
    _context: vscode.ExtensionContext,
    ctx: CommandContext,
): vscode.Disposable {
    return vscode.commands.registerCommand(
        'agentSkillsManager.openManager',
        async () => {
            await ctx.refreshAll();
            ctx.agentsProvider.refresh(ctx.getCachedAgents());
            const mcpServers = await ctx.mcpManager.detectAll();
            ctx.setCachedMcp(mcpServers);
            ctx.mcpProvider.refresh(mcpServers);
            await openManagerPanel(ctx);
        },
    );
}

async function openManagerPanel(ctx: CommandContext): Promise<void> {
    let panel = ctx.getManagerPanel();
    if (panel) {
        panel.reveal(vscode.ViewColumn.One);
        await ctx.updateManagerPanel();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'agentSkillsManager.manager',
        'ASmanager',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            retainContextWhenHidden: true,
        },
    );

    panel.onDidDispose(() => {
        ctx.setManagerPanel(undefined);
    });

    panel.webview.onDidReceiveMessage(
        async (message: {
            command?: string;
            payload?: Record<string, unknown>;
        }) => {
            if (message.command) {
                await runDashboardCommand(ctx, message.command, message.payload);
            }
        },
    );

    ctx.setManagerPanel(panel);
    await ctx.updateManagerPanel();
}

async function runDashboardCommand(
    ctx: CommandContext,
    command: string,
    payload?: Record<string, unknown>,
): Promise<void> {
    switch (command) {
        case 'refresh':
            await ctx.refreshAll();
            break;
        case 'deleteSkill': {
            if (!payload?.path) {
                return;
            }
            const skillName = String(payload.name || '');
            const choice = await vscode.window.showWarningMessage(
                localize(
                    `Delete skill "${skillName}"? This will remove ${String(payload.path)}.`,
                    `删除技能"${skillName}"？这将移除 ${String(payload.path)}。`,
                ),
                { modal: true },
                t('delete'),
            );
            if (choice !== t('delete')) {
                return;
            }
            const repository = new SkillRepository(getCentralRepository());
            await repository.deleteSkill(String(payload.path));
            break;
        }
        case 'removeSource': {
            if (!payload?.url) {
                return;
            }
            const choice = await vscode.window.showWarningMessage(
                localize(
                    `Remove source "${String(payload.url)}"?`,
                    `移除来源"${String(payload.url)}"？`,
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
            const updated = existing.filter(
                (url) => url !== String(payload.url),
            );
            await configuration.update(
                'sources',
                updated,
                vscode.ConfigurationTarget.Global,
            );
            await ctx.getSourceManager().removeSourceCache(String(payload.url));
            break;
        }
        case 'toggleMcpServer': {
            if (!payload?.name || !payload?.sourcePath) {
                return;
            }
            const mcpServers = ctx.getCachedMcp();
            const target = mcpServers.find(
                (s) =>
                    s.name === String(payload.name) &&
                    s.sourcePath === String(payload.sourcePath),
            );
            if (!target) {
                return;
            }
            const toggled = await ctx.mcpManager.toggleEnabled(target);
            const refreshed = await ctx.mcpManager.detectAll();
            ctx.setCachedMcp(refreshed);
            ctx.mcpProvider.refresh(refreshed);
            vscode.window.showInformationMessage(
                localize(
                    `${target.name} is now ${toggled ? 'enabled' : 'disabled'}.`,
                    `${target.name} 现在${toggled ? '已启用' : '已禁用'}。`,
                ),
            );
            break;
        }
        case 'syncMcpServer': {
            if (!payload?.name || !payload?.sourcePath) {
                return;
            }
            const mcpServers = ctx.getCachedMcp();
            const source = mcpServers.find(
                (s) =>
                    s.name === String(payload.name) &&
                    s.sourcePath === String(payload.sourcePath),
            );
            if (!source) {
                return;
            }
            const allTargets = ctx.buildMcpTargetList();
            const targetPick = await vscode.window.showQuickPick(
                allTargets.map((t) => ({
                    label: t.toolName,
                    description: t.configPath,
                    target: t,
                })),
                {
                    title: localize(
                        `Sync ${source.name} to which config?`,
                        `将 ${source.name} 同步到哪个配置？`,
                    ),
                },
            );
            if (!targetPick) {
                return;
            }
            await ctx.mcpManager.syncServer(
                source,
                targetPick.target.configPath,
            );
            vscode.window.showInformationMessage(
                localize(
                    `Synced ${source.name} to ${targetPick.target.toolName}.`,
                    `已将 ${source.name} 同步到 ${targetPick.target.toolName}。`,
                ),
            );
            break;
        }
        case 'detectMcp': {
            const refreshed = await ctx.mcpManager.detectAll();
            ctx.setCachedMcp(refreshed);
            ctx.mcpProvider.refresh(refreshed);
            break;
        }
        case 'updateSources':
        case 'installSkillFromSource':
        case 'detectAgents':
        case 'diagnoseSkills':
        case 'addSource':
        case 'openRepository':
        case 'backupRepository':
        case 'healthCheckMcp':
        case 'showSyncRecords':
        case 'syncSkillToAgents':
        case 'manageSources':
            await vscode.commands.executeCommand(
                `agentSkillsManager.${command}`,
            );
            break;
        default:
            return;
    }

    await ctx.refreshAll();
    await ctx.updateManagerPanel();
}
